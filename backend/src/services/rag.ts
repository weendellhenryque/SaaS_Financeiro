import { prisma } from '../db/prisma.js';
import { getEmbedding, generateRAGResponse } from './gemini.js';
import { QueryChannel } from '@prisma/client';

interface SearchChunkResult {
  id: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  driveFileId: string;
  fileName: string;
  webViewLink: string | null;
  similarity: number;
}

interface AskRAGResult {
  answer: string;
  sources: Array<{
    fileName: string;
    webViewLink: string | null;
    pageNumber: number | null;
    score: number;
  }>;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Realiza a busca semântica (vetorial) por proximidade de cosseno no banco de dados.
 */
export async function searchSemanticChunks(
  clienteId: string,
  questionEmbedding: number[],
  limit = 5
): Promise<SearchChunkResult[]> {
  try {
    // pgvector exige passar o array formatado como string '[val1,val2,...]' no raw query
    const embeddingStr = `[${questionEmbedding.join(',')}]`;

    const chunks: any[] = await prisma.$queryRaw`
      SELECT 
        dc.id, 
        dc.content, 
        dc."pageNumber", 
        dc."chunkIndex", 
        dc."driveFileId",
        df."fileName", 
        df."webViewLink",
        (1 - (dc.embedding <=> ${embeddingStr}::vector)) as similarity
      FROM "DocChunk" dc
      JOIN "DriveFile" df ON dc."driveFileId" = df.id
      WHERE dc."clienteId" = ${clienteId}
      ORDER BY dc.embedding <=> ${embeddingStr}::vector ASC
      LIMIT ${limit}
    `;

    return chunks.map((c) => ({
      id: c.id,
      content: c.content,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex,
      driveFileId: c.driveFileId,
      fileName: c.fileName,
      webViewLink: c.webViewLink,
      similarity: Number(c.similarity),
    }));
  } catch (err: any) {
    console.error('❌ Erro na busca semântica com pgvector:', err.message);
    throw err;
  }
}

/**
 * Pipeline RAG completo:
 * 1. Gera o embedding da pergunta.
 * 2. Busca os chunks semânticos mais relevantes do cliente específico.
 * 3. Envia o contexto consolidado ao Gemini.
 * 4. Salva o log de auditoria no banco.
 */
export async function askRAG(
  userId: string,
  question: string,
  clienteId: string,
  clienteName: string,
  channel: QueryChannel = QueryChannel.DASHBOARD
): Promise<AskRAGResult> {
  const startTime = Date.now();
  let embedding: number[] = [];
  let chunks: SearchChunkResult[] = [];
  let answer = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let errorMsg: string | null = null;

  try {
    // 1. Gerar embedding da pergunta
    embedding = await getEmbedding(question);

    // 2. Buscar fragmentos mais próximos no banco
    chunks = await searchSemanticChunks(clienteId, embedding, 5);

    if (chunks.length === 0) {
      answer = `Olá! Não encontrei nenhum documento indexado para o cliente "${clienteName}" na minha base de dados atual. 
Certifique-se de que a sincronização do Google Drive foi concluída para esta empresa.`;
    } else {
      // 3. Chamar Gemini para consolidar a resposta com citação de fontes
      const ragRes = await generateRAGResponse(question, clienteName, chunks);
      answer = ragRes.answer;
      tokensIn = ragRes.tokensIn;
      tokensOut = ragRes.tokensOut;
    }
  } catch (err: any) {
    errorMsg = err.message;
    answer = `Desculpe, ocorreu um erro técnico ao processar sua pergunta: ${err.message}`;
    console.error('❌ Erro no fluxo askRAG:', err);
  }

  const latencyMs = Date.now() - startTime;

  // 4. Salvar log de auditoria
  try {
    const formattedSources = chunks.map((c) => ({
      driveFileId: c.driveFileId,
      fileName: c.fileName,
      score: c.similarity,
      pageNumber: c.pageNumber,
    }));

    await prisma.queryLog.create({
      data: {
        userId,
        clienteId,
        question,
        answer,
        sources: formattedSources,
        channel,
        latencyMs,
        tokensIn,
        tokensOut,
        errorMsg,
      },
    });
  } catch (logErr: any) {
    console.error('⚠️ Não foi possível salvar o log de auditoria da query:', logErr.message);
  }

  return {
    answer,
    sources: chunks.map((c) => ({
      fileName: c.fileName,
      webViewLink: c.webViewLink,
      pageNumber: c.pageNumber,
      score: c.similarity,
    })),
    latencyMs,
    tokensIn,
    tokensOut,
  };
}
