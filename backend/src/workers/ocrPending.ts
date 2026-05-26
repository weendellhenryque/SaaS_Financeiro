import { prisma } from '../db/prisma.js';
import { downloadFile } from '../services/drive.js';
import { performOcr } from '../services/ocr.js';
import { chunkText } from '../services/chunker.js';
import { getEmbedding } from '../services/gemini.js';
import { IndexStatus } from '@prisma/client';
import crypto from 'crypto';

const LOOP_DELAY_MS = 3000; // Delay se não houver fila de OCR

/**
 * Processa um único arquivo que necessita de OCR.
 */
export async function processOcrFile(file: any) {
  const fileId = file.id;
  const driveId = file.driveFileId;
  const mimeType = file.mimeType;
  const clienteId = file.clienteId;

  console.log(`\n📷 [OcrPending] Iniciando OCR do arquivo: "${file.fileName}" (${mimeType})`);

  try {
    // 1. Marcar como Extraindo
    await prisma.driveFile.update({
      where: { id: fileId },
      data: { indexStatus: IndexStatus.EXTRACTING },
    });

    // 2. Baixar arquivo do Google Drive
    const buffer = await downloadFile(driveId, mimeType);

    // 3. Executar OCR usando Google Cloud Vision
    const ocrResult = await performOcr(buffer, mimeType);
    const textLength = ocrResult.text.trim().length;

    console.log(`[OcrPending] OCR concluído. ${textLength} caracteres extraídos (${ocrResult.pageCount} páginas).`);

    if (textLength === 0) {
      throw new Error('Nenhum caractere ou texto foi identificado pelo Vision OCR neste documento.');
    }

    // 4. Fatiar texto do OCR em chunks
    console.log('✂️ [OcrPending] Fatiando texto obtido via OCR...');
    const chunks = chunkText(ocrResult.text, {
      maxChunkSize: 800,
      overlapSize: 150,
      fileName: file.fileName,
    });

    console.log(`🧩 [OcrPending] Gerando embeddings para ${chunks.length} chunks de OCR...`);

    // 5. Gerar embeddings e salvar no banco via raw SQL
    await prisma.docChunk.deleteMany({
      where: { driveFileId: fileId },
    });

    let index = 0;
    for (const chunk of chunks) {
      const chunkId = crypto.randomUUID();
      const embedding = await getEmbedding(chunk.content);
      const embeddingStr = `[${embedding.join(',')}]`;

      await prisma.$executeRaw`
        INSERT INTO "DocChunk" ("id", "driveFileId", "clienteId", "content", "pageNumber", "chunkIndex", "embedding")
        VALUES (${chunkId}, ${fileId}, ${clienteId}, ${chunk.content}, ${chunk.pageNumber || null}, ${index}, ${embeddingStr}::vector)
      `;
      index++;
    }

    // 6. Marcar como Indexado
    await prisma.driveFile.update({
      where: { id: fileId },
      data: {
        indexStatus: IndexStatus.INDEXED,
        isScanned: true,
        pageCount: ocrResult.pageCount,
        errorMessage: null,
        indexedAt: new Date(),
      },
    });

    console.log(`✅ [OcrPending] SUCESSO: "${file.fileName}" indexado via OCR com ${chunks.length} chunks.`);
  } catch (err: any) {
    console.error(`❌ [OcrPending] Erro no OCR do arquivo "${file.fileName}":`, err.message);

    await prisma.driveFile.update({
      where: { id: fileId },
      data: {
        indexStatus: IndexStatus.FAILED,
        errorMessage: `Erro no OCR: ${err.message}`,
      },
    });
  }
}

/**
 * Loop principal do Worker de OCR.
 */
async function main() {
  console.log('🚀 [Worker OcrPending] Processador de fila de OCR inicializado.');

  while (true) {
    try {
      // Busca o próximo arquivo NEEDS_OCR da fila
      const nextFile = await prisma.driveFile.findFirst({
        where: {
          indexStatus: IndexStatus.NEEDS_OCR,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (nextFile) {
        await processOcrFile(nextFile);
      } else {
        await new Promise((resolve) => setTimeout(resolve, LOOP_DELAY_MS));
      }
    } catch (loopErr: any) {
      console.error('❌ [Worker OcrPending] Erro no loop de OCR:', loopErr.message);
      await new Promise((resolve) => setTimeout(resolve, LOOP_DELAY_MS));
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('ocrPending.ts')) {
  main().catch((err) => {
    console.error('❌ [Worker OcrPending] Falha fatal:', err);
    process.exit(1);
  });
}
