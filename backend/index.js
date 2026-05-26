require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { initWhatsApp, sendMessage } = require('./services/whatsapp');
const { parseWhatsAppMessage } = require('./services/gemini');
const { getOrCreateDocument, addRowToGoogleSpreadsheet } = require('./services/googleDrive');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Configurações de Middleware
app.use(cors());
app.use(express.json());

// Injetar Rotas
app.use('/api', apiRoutes);

// Rota raiz para status rápido do servidor
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    message: '🚀 Servidor SaaS Financeiro Contábil rodando com sucesso!',
    timestamp: new Date()
  });
});

// Seed inicial para o Tenant de demonstração (se não existir nenhum)
async function seedDemoData() {
  try {
    const tenantCount = await prisma.tenant.count();
    if (tenantCount === 0) {
      console.log('🌱 Banco de dados limpo detectado. Criando dados demo...');
      const demoTenant = await prisma.tenant.create({
        data: {
          id: 'demo-tenant-id-123',
          name: 'Grupo contábil Bastos & Luz',
          cnpj: '12.345.678/0001-90'
        }
      });

      const demoUser = await prisma.user.create({
        data: {
          name: 'Alessandro Bastos',
          email: 'alessandro@bastoseluz.com.br',
          password: 'Password_Demo_2026', // Idealmente criptografar com bcrypt em prod
          role: 'ADMIN',
          tenantId: demoTenant.id
        }
      });

      console.log('🌱 Tenant e Usuário de demonstração criados com sucesso!');
    } else {
      // Garantir que o nome está correto se já existir
      await prisma.tenant.updateMany({
        where: { id: 'demo-tenant-id-123' },
        data: { name: 'Grupo contábil Bastos & Luz' }
      });
      await prisma.user.updateMany({
        where: { tenantId: 'demo-tenant-id-123', role: 'ADMIN' },
        data: { name: 'Alessandro Bastos', email: 'alessandro@bastoseluz.com.br' }
      });
      console.log('🌱 Tenant de demonstração atualizado para Grupo contábil Bastos & Luz!');
    }
  } catch (err) {
    console.error('Erro ao semear banco de dados:', err);
  }
}

// Loop Principal para mensagens reais do WhatsApp (quando conectado fisicamente)
async function handleIncomingWhatsAppMessage(msg) {
  const senderJid = msg.key.remoteJid;
  const messageText = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      '';

  if (!messageText) return;

  console.log(`💬 Mensagem Real recebida do WhatsApp (${senderJid}): "${messageText}"`);

  // Tenant ID padrão de demonstração para o bot físico do WhatsApp
  const tenantId = 'demo-tenant-id-123';

  try {
    // 1. Enviar para a inteligência artificial do Gemini
    const parsed = await parseWhatsAppMessage(messageText);

    if (parsed.action === 'edit_spreadsheet' || parsed.action === 'create_document') {
      // 2. Buscar ou criar a planilha no Drive
      const doc = await getOrCreateDocument(tenantId, parsed.documentName, 'spreadsheet');

      // 3. Adicionar os dados contábeis estruturados na planilha
      await addRowToGoogleSpreadsheet(doc.driveFileId, parsed.data);

      // 4. Salvar log de atividade
      await prisma.activityLog.create({
        data: {
          action: 'Planilha Editada via WhatsApp',
          details: `Lançamento: R$ ${parsed.data.amount} em '${parsed.data.category}' (${parsed.data.description})`,
          documentId: doc.id,
          whatsappSender: senderJid.split('@')[0]
        }
      });

      // Atualizar timestamp do documento
      await prisma.document.update({
        where: { id: doc.id },
        data: { updatedAt: new Date() }
      });

      // 5. Responder de volta no WhatsApp com a resposta formulada pelo Gemini
      await sendMessage(senderJid, parsed.replyMessage);
    } else {
      // Se não compreendeu ou é uma mensagem geral, apenas responde educadamente
      await sendMessage(senderJid, parsed.replyMessage);
    }
  } catch (err) {
    console.error('Erro ao processar mensagem do WhatsApp:', err);
    try {
      await sendMessage(senderJid, 'Desculpe! Ocorreu um problema ao registrar seu lançamento na planilha. Por favor, tente novamente de forma mais direta.');
    } catch (e) {
      console.error('Erro ao enviar mensagem de erro de fallback:', e);
    }
  }
}

// Inicializar e rodar o Servidor
async function startServer() {
  // Semeamento de dados demo no DB
  await seedDemoData();

  app.listen(PORT, () => {
    console.log(`======================================================================`);
    console.log(`🎉 Servidor rodando com sucesso na porta: ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`======================================================================`);
  });

  // Inicializar o bot do WhatsApp em segundo plano
  try {
    console.log('🤖 Inicializando robô de WhatsApp...');
    await initWhatsApp(handleIncomingWhatsAppMessage);
  } catch (err) {
    console.error('⚠️ Falha ao inicializar o WhatsApp:', err);
  }
}

startServer();
