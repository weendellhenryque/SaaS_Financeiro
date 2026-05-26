const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getWhatsAppStatus, sendMessage } = require('../services/whatsapp');
const { parseWhatsAppMessage } = require('../services/gemini');
const { getOrCreateDocument, addRowToGoogleSpreadsheet, listDriveFiles } = require('../services/googleDrive');

const prisma = new PrismaClient();

// 1. Obter status do WhatsApp e QR Code
router.get('/whatsapp/status', (req, res) => {
  try {
    const status = getWhatsAppStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Listar documentos (planilhas/docs) vinculados ao Tenant (multi-tenant)
router.get('/documents', async (req, res) => {
  const { tenantId } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Parâmetro tenantId é obrigatório' });
  }

  try {
    const docs = await prisma.document.findMany({
      where: { tenantId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Criar uma nova planilha/documento
router.post('/documents', async (req, res) => {
  const { tenantId, name, type } = req.body;

  if (!tenantId || !name) {
    return res.status(400).json({ error: 'tenantId e name são obrigatórios' });
  }

  try {
    const doc = await getOrCreateDocument(tenantId, name, type || 'spreadsheet');
    
    // Registrar atividade de criação
    await prisma.activityLog.create({
      data: {
        action: 'Documento Criado',
        details: `Criado o documento '${name}' no Google Drive.`,
        documentId: doc.id
      }
    });

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Obter histórico geral de atividades (WhatsApp e Edições)
router.get('/logs', async (req, res) => {
  const { tenantId } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Parâmetro tenantId é obrigatório' });
  }

  try {
    const logs = await prisma.activityLog.findMany({
      where: {
        document: { tenantId }
      },
      include: {
        document: {
          select: { name: true, type: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Rota de Simulação (Ideal para Testar sem escanear o QR Code)
router.post('/whatsapp/simulate', async (req, res) => {
  const { messageText, senderNumber, tenantId } = req.body;

  if (!messageText || !tenantId) {
    return res.status(400).json({ error: 'messageText e tenantId são obrigatórios' });
  }

  const sender = senderNumber || '5511999999999';

  try {
    console.log(`💬 Simulação de mensagem recebida no WhatsApp: "${messageText}" de: ${sender}`);
    
    // 1. Chamar o Gemini para interpretar a intenção do cliente
    const parsed = await parseWhatsAppMessage(messageText);
    
    if (parsed.action === 'edit_spreadsheet' || parsed.action === 'create_document') {
      // 2. Buscar ou criar a planilha correspondente no banco e no Google Drive
      const doc = await getOrCreateDocument(tenantId, parsed.documentName, 'spreadsheet');
      
      // 3. Adicionar a linha com os dados financeiros estruturados na planilha real do Google
      await addRowToGoogleSpreadsheet(doc.driveFileId, parsed.data);
      
      // 4. Registrar o log de auditoria no Banco de Dados PostgreSQL
      await prisma.activityLog.create({
        data: {
          action: 'Planilha Editada via WhatsApp (Simulação)',
          details: `Adicionado: R$ ${parsed.data.amount} em '${parsed.data.category}' (${parsed.data.description})`,
          documentId: doc.id,
          whatsappSender: sender
        }
      });

      // Atualizar timestamp do documento
      await prisma.document.update({
        where: { id: doc.id },
        data: { updatedAt: new Date() }
      });

      return res.json({
        success: true,
        interpretation: parsed,
        message: parsed.replyMessage,
        details: `Dados inseridos em: '${parsed.documentName}'`
      });
    }

    res.json({
      success: false,
      interpretation: parsed,
      message: parsed.replyMessage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
