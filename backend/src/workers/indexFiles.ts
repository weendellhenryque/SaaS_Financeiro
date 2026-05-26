import { prisma } from '../db/prisma.js';
import { downloadFile } from '../services/drive.js';
import { extract } from '../services/extractor.js';
import { chunkText } from '../services/chunker.js';
import { getEmbedding } from '../services/gemini.js';
import { IndexStatus } from '@prisma/client';
import crypto from 'crypto';

const TEXT_THRESHOLD = 150; // Menos de 150 caracteres em PDF -> escaneado!
const LOOP_DELAY_MS = 2000;  // Delay se não houver fila

/**
 * Processa um único arquivo pendente de indexação.
 */
export async function processFile(file: any) {
  const fileId = file.id;
  const driveId = file.driveFileId;
  const mimeType = file.mimeType;
  const clienteId = file.clienteId;

  console.log(`\n⚙️ [IndexFiles] Processando arquivo: "${file.fileName}" (${mimeType})`);

  try {
    // 1. Marcar como Extraindo
    await prisma.driveFile.update({
      where: { id: fileId },
      data: { indexStatus: IndexStatus.EXTRACTING },
    });

    // 2. Baixar arquivo do Google Drive
    const buffer = await downloadFile(driveId, mimeType);

    // 3. Detectar se houve alteração real de conteúdo pelo hash (opcional)
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 4. Extrair texto bruto
    const textResult = await extract(buffer, mimeType, file.fileName);
    const textLength = textResult.totalText.trim().length;

    // 5. Verificar se é PDF escaneado (precisa de OCR)
    if (mimeType.toLowerCase() === 'application/pdf' && textLength < TEXT_THRESHOLD) {
      console.log(`📷 [IndexFiles] Baixa densidade textual (${textLength} chars). Direcionando para fila de OCR.`);
      await prisma.driveFile.update({
        where: { id: fileId },
        data: {
          indexStatus: IndexStatus.NEEDS_OCR,
          contentHash,
          isScanned: true,
        },
      });
      return;
    }

    // 6. Fatiar texto em chunks
    console.log(`✂️ [IndexFiles] Fatiando texto (${textLength} caracteres)...`);
    const chunks = chunkText(textResult.totalText, {
      maxChunkSize: 800,
      overlapSize: 150,
      fileName: file.fileName,
    });

    console.log(`🧩 [IndexFiles] Gerando embeddings para ${chunks.length} chunks...`);

    // 7. Gerar embeddings e salvar no banco via raw SQL
    // Deleta chunks anteriores caso seja uma reindexação
    await prisma.docChunk.deleteMany({
      where: { driveFileId: fileId },
    });

    let index = 0;
    for (const chunk of chunks) {
      const chunkId = crypto.randomUUID();
      const embedding = await getEmbedding(chunk.content);
      const embeddingStr = `[${embedding.join(',')}]`;

      // Insere com raw SQL para salvar a coluna vector(768)
      await prisma.$executeRaw`
        INSERT INTO "DocChunk" ("id", "driveFileId", "clienteId", "content", "pageNumber", "chunkIndex", "embedding")
        VALUES (${chunkId}, ${fileId}, ${clienteId}, ${chunk.content}, ${chunk.pageNumber || null}, ${index}, ${embeddingStr}::vector)
      `;
      index++;
    }

    // 8. Finalizar marcação como Indexado
    await prisma.driveFile.update({
      where: { id: fileId },
      data: {
        indexStatus: IndexStatus.INDEXED,
        contentHash,
        isScanned: false,
        pageCount: textResult.pageCount || 1,
        errorMessage: null,
        indexedAt: new Date(),
      },
    });

    console.log(`✅ [IndexFiles] SUCESSO: "${file.fileName}" indexado com ${chunks.length} chunks.`);
  } catch (err: any) {
    console.error(`❌ [IndexFiles] Erro ao indexar arquivo "${file.fileName}":`, err.message);
    
    // Atualizar status para FAILED
    await prisma.driveFile.update({
      where: { id: fileId },
      data: {
        indexStatus: IndexStatus.FAILED,
        errorMessage: err.message,
      },
    });
  }
}

/**
 * Loop principal do Worker de Indexação.
 */
async function main() {
  console.log('🚀 [Worker IndexFiles] Processador de fila de indexação inicializado.');

  while (true) {
    try {
      // Busca o próximo arquivo PENDING da fila
      const nextFile = await prisma.driveFile.findFirst({
        where: {
          indexStatus: IndexStatus.PENDING,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (nextFile) {
        await processFile(nextFile);
      } else {
        // Sem arquivos na fila, aguarda um tempo antes de consultar novamente
        await new Promise((resolve) => setTimeout(resolve, LOOP_DELAY_MS));
      }
    } catch (loopErr: any) {
      console.error('❌ [Worker IndexFiles] Erro no loop de indexação:', loopErr.message);
      await new Promise((resolve) => setTimeout(resolve, LOOP_DELAY_MS));
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('indexFiles.ts')) {
  main().catch((err) => {
    console.error('❌ [Worker IndexFiles] Falha fatal:', err);
    process.exit(1);
  });
}
