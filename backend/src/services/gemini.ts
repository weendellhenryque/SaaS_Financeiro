import { geminiModel, embeddingModel } from '../config/google.js';

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0 && (err.message?.includes('429') || err.message?.includes('quota'))) {
      console.warn(`⚠️ [Gemini] Limite de requisições ou cota (429) atingido. Retentando em ${delay}ms... (${retries} tentativas restantes)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

/**
 * Gera o vetor de embedding (768 dimensões) para um texto.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const result = await retryWithBackoff(() => 
      embeddingModel.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      })
    );
    if (!result.embedding?.values) {
      throw new Error('Vetor de embedding retornado vazio pela API do Gemini.');
    }
    return result.embedding.values;
  } catch (err: any) {
    console.error('❌ Erro ao gerar embedding no Gemini:', err.message);
    throw err;
  }
}

interface ContextChunk {
  fileName: string;
  content: string;
  pageNumber?: number | null;
}

/**
 * Executa a consolidação final da resposta (RAG) usando o Gemini 2.5 Flash.
 */
export async function generateRAGResponse(
  question: string,
  clientName: string,
  chunks: ContextChunk[]
): Promise<{ answer: string; tokensIn: number; tokensOut: number }> {
  try {
    // 1. Formatar o contexto dos pedaços de documentos
    const contextText = chunks
      .map((c, idx) => {
        const pageInfo = c.pageNumber ? `, Página ${c.pageNumber}` : '';
        return `[Documento #${idx + 1}: ${c.fileName}${pageInfo}]\n${c.content}\n`;
      })
      .join('\n---\n\n');

    // 2. Construir o System Prompt & Prompt de Entrada
    const systemPrompt = `Você é o assistente virtual inteligente da empresa "Grupo contábil Bastos & Luz", focado em responder a dúvidas internas da equipe sobre os documentos contábeis, fiscais, trabalhistas e societários de seus clientes.
O cliente em questão é: "${clientName}".

Instruções fundamentais:
1. Responda à pergunta baseando-se EXCLUSIVAMENTE nas informações contidas nos fragmentos de documentos contábeis fornecidos no contexto abaixo.
2. Seja preciso, técnico e profissional. Cite sempre os nomes dos arquivos originais e a página específica (se disponível) para embasar sua resposta.
3. Formate suas respostas de maneira limpa em markdown, destacando valores monetários, datas e obrigações.
4. Se o contexto não contiver a resposta para a pergunta, admita de forma cortês e profissional que não encontrou essa informação nos arquivos do cliente "${clientName}" e sugira o que pode estar faltando. NÃO tente inventar ou utilizar conhecimentos externos de fora dos documentos fornecidos.`;

    const userPrompt = `DOCUMENTOS FORNECIDOS PARA CONSULTA:
---
${contextText}
---

PERGUNTA DO FUNCIONÁRIO:
"${question}"

Por favor, elabore a resposta técnica fundamentada com as devidas citações de fontes (nome do arquivo e página).`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // 3. Obter contagem de tokens (estimativa de input)
    let tokensIn = 0;
    try {
      const tokenCountRes = await geminiModel.countTokens(fullPrompt);
      tokensIn = tokenCountRes.totalTokens;
    } catch {
      // Fallback simples se countTokens falhar
      tokensIn = Math.round(fullPrompt.length / 4);
    }

    // 4. Chamar o modelo
    const response = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: systemPrompt,
    });

    const answer = response.response.text();
    
    // 5. Obter contagem de tokens do output
    let tokensOut = 0;
    try {
      const tokenCountOutRes = await geminiModel.countTokens(answer);
      tokensOut = tokenCountOutRes.totalTokens;
    } catch {
      tokensOut = Math.round(answer.length / 4);
    }

    return {
      answer,
      tokensIn,
      tokensOut,
    };
  } catch (err: any) {
    console.error('❌ Erro no pipeline de geração do Gemini:', err.message);
    throw err;
  }
}
