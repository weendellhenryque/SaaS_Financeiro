import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { copyFile, deleteFile, overwriteFile, downloadFile, updateFileContent } from '../services/drive.js';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * GET /api/files
 * Lista todos os arquivos espelhados de um determinado cliente (clienteId).
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { clienteId } = req.query;

  if (!clienteId || typeof clienteId !== 'string') {
    return res.status(400).json({ error: 'O parâmetro clienteId é obrigatório.' });
  }

  try {
    const files = await prisma.driveFile.findMany({
      where: { clienteId },
      orderBy: { fileName: 'asc' },
    });

    // Converte BigInt para Number para evitar erros de serialização do JSON
    const serializedFiles = files.map((f) => ({
      ...f,
      sizeBytes: Number(f.sizeBytes),
    }));

    return res.json(serializedFiles);
  } catch (err: any) {
    console.error('❌ Erro ao listar arquivos:', err.message);
    return res.status(500).json({ error: 'Erro ao listar arquivos do cliente.' });
  }
});

/**
 * POST /api/files/draft/create
 * Cria uma cópia temporária do arquivo no Google Drive para edição segura.
 * Se a Conta de Serviço falhar por falta de cota (Personal My Drive), ativa o Modo de Edição Direta com Backup.
 */
router.post('/draft/create', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { fileId } = req.body;

  if (!fileId) {
    return res.status(400).json({ error: 'O parâmetro fileId é obrigatório.' });
  }

  try {
    const file = await prisma.driveFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return res.status(404).json({ error: 'Arquivo original não encontrado.' });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: file.clienteId },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente associado não encontrado.' });
    }

    const draftName = `[RASCUNHO] ${file.fileName}`;
    let draftFileId: string;
    let webViewLink: string;

    try {
      console.log(`📂 Tentando criar cópia temporária no Drive: ${draftName} na pasta do cliente: ${cliente.driveFolderId}`);
      const draft = await copyFile(file.driveFileId, draftName, cliente.driveFolderId);
      draftFileId = draft.id;
      webViewLink = draft.webViewLink;
    } catch (copyErr: any) {
      const errStr = copyErr.message || '';
      const isQuotaErr = errStr.includes('quota') || 
                         errStr.includes('storage') || 
                         errStr.includes('Shared drives') || 
                         errStr.includes('OAuth delegation');
      if (isQuotaErr) {
        console.log(`⚠️ [files.ts] Restrição de cota do Google detectada. Ativando Modo Edição Direta no Original com backup de segurança local para "${file.fileName}".`);
        
        // Baixa o conteúdo atual do arquivo original para servir de backup (em caso de descarte)
        const backupBuffer = await downloadFile(file.driveFileId, file.mimeType);
        
        const backupDir = path.join(process.cwd(), 'temp_backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, `${file.id}.backup`);
        fs.writeFileSync(backupPath, backupBuffer);
        console.log(`✅ [files.ts] Backup de segurança do arquivo criado localmente em: ${backupPath}`);
        
        // Retorna ID fictício com prefixo para sinalizar o modo de edição direta e o link do próprio original
        draftFileId = `DIRECT_EDIT_${file.id}`;
        webViewLink = file.webViewLink || '';
      } else {
        throw copyErr;
      }
    }

    return res.json({
      draftFileId,
      webViewLink,
    });
  } catch (err: any) {
    console.error('❌ Erro ao criar rascunho:', err.message);
    return res.status(500).json({ error: 'Erro ao criar rascunho temporário no Drive.' });
  }
});

/**
 * POST /api/files/draft/save
 * Aplica as edições do rascunho de volta no arquivo original e apaga o rascunho.
 */
router.post('/draft/save', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { fileId, draftFileId } = req.body;

  if (!fileId || !draftFileId) {
    return res.status(400).json({ error: 'Os parâmetros fileId e draftFileId são obrigatórios.' });
  }

  try {
    const file = await prisma.driveFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return res.status(404).json({ error: 'Arquivo original não encontrado.' });
    }

    if (draftFileId.startsWith('DIRECT_EDIT_')) {
      // Modo Edição Direta: o arquivo original já foi editado no Drive. 
      // Só precisamos limpar o backup local.
      console.log(`💾 [files.ts] Confirmando alterações diretas efetuadas em "${file.fileName}".`);
      const backupPath = path.join(process.cwd(), 'temp_backups', `${file.id}.backup`);
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        console.log(`🗑️ [files.ts] Backup de segurança local excluído pois a alteração foi confirmada.`);
      }
    } else {
      // Modo Normal: sobrescreve o arquivo original com o rascunho e deleta o rascunho do Google Drive
      console.log(`💾 Sobrescrevendo arquivo original (${file.fileName}) com rascunho (${draftFileId})`);
      await overwriteFile(file.driveFileId, draftFileId, file.mimeType);

      console.log(`🗑️ Excluindo rascunho temporário no Drive...`);
      await deleteFile(draftFileId);
    }

    // Reseta status do arquivo original no banco de dados para reprocessamento imediato do RAG
    await prisma.driveFile.update({
      where: { id: fileId },
      data: {
        indexStatus: 'PENDING',
        errorMessage: null,
      },
    });

    return res.json({ success: true, message: 'Alterações aplicadas com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao salvar rascunho:', err.message);
    return res.status(500).json({ error: 'Erro ao salvar alterações no Drive.' });
  }
});

/**
 * POST /api/files/draft/discard
 * Descarta o rascunho temporário excluindo-o do Google Drive (ou restaurando o backup local).
 */
router.post('/draft/discard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { draftFileId } = req.body;

  if (!draftFileId) {
    return res.status(400).json({ error: 'O parâmetro draftFileId é obrigatório.' });
  }

  try {
    if (draftFileId.startsWith('DIRECT_EDIT_')) {
      // Modo Edição Direta: precisamos restaurar o arquivo original com o backup local
      const fileId = draftFileId.replace('DIRECT_EDIT_', '');
      console.log(`🗑️ [files.ts] Descartando alterações diretas. Restaurando backup para o arquivo ID: ${fileId}`);
      
      const file = await prisma.driveFile.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return res.status(404).json({ error: 'Arquivo original não encontrado para restaurar.' });
      }

      const backupPath = path.join(process.cwd(), 'temp_backups', `${file.id}.backup`);
      if (fs.existsSync(backupPath)) {
        const backupBuffer = fs.readFileSync(backupPath);
        console.log(`🔄 [files.ts] Restaurando backup de segurança de volta no Google Drive...`);
        await updateFileContent(file.driveFileId, backupBuffer, file.mimeType);
        
        fs.unlinkSync(backupPath);
        console.log(`🗑️ [files.ts] Backup de segurança local excluído.`);
      } else {
        console.warn(`⚠️ [files.ts] Nenhum backup de segurança encontrado em ${backupPath}. Nada foi restaurado.`);
      }
    } else {
      // Modo Normal: exclui o rascunho do Google Drive
      console.log(`🗑️ Descartando e excluindo rascunho temporário no Drive: ${draftFileId}`);
      await deleteFile(draftFileId);
    }
    return res.json({ success: true, message: 'Rascunho descartado com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao descartar rascunho:', err.message);
    return res.status(500).json({ error: 'Erro ao descartar rascunho temporário.' });
  }
});

/**
 * POST /api/files/:id/reindex
 * Reseta o status de um arquivo específico para PENDING para forçar reprocessamento do RAG.
 */
router.post('/:id/reindex', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const file = await prisma.driveFile.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    await prisma.driveFile.update({
      where: { id },
      data: {
        indexStatus: 'PENDING',
        errorMessage: null,
      },
    });

    console.log(`🔄 [files.ts] Arquivo "${file.fileName}" marcado para reindexação.`);
    return res.json({ success: true, message: 'Arquivo enviado para fila de reindexação.' });
  } catch (err: any) {
    console.error('❌ Erro ao reindexar arquivo:', err.message);
    return res.status(500).json({ error: 'Erro ao enviar arquivo para reindexação.' });
  }
});

/**
 * POST /api/files/reindex-failed
 * Reseta o status de todos os arquivos com falha de um cliente para PENDING.
 */
router.post('/reindex-failed', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { clienteId } = req.body;

  if (!clienteId) {
    return res.status(400).json({ error: 'O parâmetro clienteId é obrigatório.' });
  }

  try {
    const result = await prisma.driveFile.updateMany({
      where: {
        clienteId,
        indexStatus: 'FAILED',
      },
      data: {
        indexStatus: 'PENDING',
        errorMessage: null,
      },
    });

    console.log(`🔄 [files.ts] ${result.count} arquivos com falha marcados para reindexação para o cliente ${clienteId}.`);
    return res.json({ success: true, count: result.count, message: `${result.count} arquivos enviados para fila de reindexação.` });
  } catch (err: any) {
    console.error('❌ Erro ao reindexar arquivos em lote:', err.message);
    return res.status(500).json({ error: 'Erro ao reindexar arquivos em lote.' });
  }
});

/**
 * GET /api/files/:id/content
 * Retorna o conteúdo textual de um arquivo (para .txt, .pem, .key, etc.)
 */
router.get('/:id/content', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const file = await prisma.driveFile.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    // Baixa o arquivo do Google Drive e converte para string
    const buffer = await downloadFile(file.driveFileId, file.mimeType);
    const content = buffer.toString('utf-8');

    console.log(`📖 [files.ts] Conteúdo do arquivo "${file.fileName}" obtido com sucesso.`);
    return res.json({ content });
  } catch (err: any) {
    console.error('❌ Erro ao obter conteúdo do arquivo:', err.message);
    return res.status(500).json({ error: 'Erro ao obter conteúdo do arquivo contábil.' });
  }
});

export default router;

