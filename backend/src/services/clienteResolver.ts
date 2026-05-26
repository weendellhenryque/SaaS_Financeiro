import { prisma } from '../db/prisma.js';
import { geminiModel } from '../config/google.js';

interface ResolvedCliente {
  id: string;
  driveFolderId: string;
  nomeEmpresa: string;
  cnpj: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolve qual cliente da base de dados está sendo referenciado em uma pergunta.
 * Usa o Gemini 2.5 Flash para extrair a entidade contábil/nome da empresa citada na pergunta
 * e em seguida realiza uma busca fuzzy (similarity + unaccent) no PostgreSQL.
 */
export async function resolveClienteFromQuestion(question: string): Promise<ResolvedCliente | null> {
  try {
    // 1. Chamar o Gemini para extrair o nome ou fragmento da empresa da pergunta
    const prompt = `Analise a pergunta de um funcionário de contabilidade e extraia APENAS o nome, apelido, sigla ou razão social da empresa/cliente que está sendo mencionada na pergunta.
Se nenhuma empresa específica for mencionada (uma pergunta geral ou abstrata), responda estritamente com a palavra "NENHUM".
Não dê explicações ou textos adicionais, responda APENAS com o termo extraído ou a palavra "NENHUM".

Pergunta: "${question}"
Termo Extraído:`;

    const geminiRes = await geminiModel.generateContent(prompt);
    const extractedTerm = geminiRes.response.text().trim().replace(/['"“”]/g, '');

    console.log(`[ClienteResolver] Termo extraído pelo Gemini: "${extractedTerm}"`);

    if (!extractedTerm || extractedTerm.toUpperCase() === 'NENHUM') {
      console.log('[ClienteResolver] Nenhuma empresa identificada na pergunta.');
      return null;
    }

    // 2. Realizar busca fuzzy com pg_trgm + unaccent no Postgres
    // Usamos $queryRaw para aproveitar a função 'similarity' do Postgres
    const resolved: any[] = await prisma.$queryRaw`
      SELECT 
        "id", "driveFolderId", "nomeEmpresa", "cnpj", "isActive", "createdAt", "updatedAt",
        similarity(unaccent("nomeEmpresa"), unaccent(${extractedTerm})) as score
      FROM "Cliente"
      WHERE "isActive" = true
        AND similarity(unaccent("nomeEmpresa"), unaccent(${extractedTerm})) >= 0.15
      ORDER BY score DESC
      LIMIT 1
    `;

    if (resolved && resolved.length > 0 && resolved[0].score > 0.15) {
      const cliente = resolved[0] as ResolvedCliente;
      console.log(`[ClienteResolver] Cliente resolvido via Fuzzy Match: "${cliente.nomeEmpresa}" (Score: ${cliente.score.toFixed(2)})`);
      return cliente;
    }

    // 3. Fallback: Se não encontrou pelo termo extraído, tenta rodar a busca fuzzy com a pergunta inteira
    console.log('[ClienteResolver] Tentando busca direta com a pergunta inteira como fallback...');
    const fallbackResolved: any[] = await prisma.$queryRaw`
      SELECT 
        "id", "driveFolderId", "nomeEmpresa", "cnpj", "isActive", "createdAt", "updatedAt",
        similarity(unaccent("nomeEmpresa"), unaccent(${question})) as score
      FROM "Cliente"
      WHERE "isActive" = true
        AND similarity(unaccent("nomeEmpresa"), unaccent(${question})) >= 0.10
      ORDER BY score DESC
      LIMIT 1
    `;

    if (fallbackResolved && fallbackResolved.length > 0 && fallbackResolved[0].score > 0.10) {
      const cliente = fallbackResolved[0] as ResolvedCliente;
      console.log(`[ClienteResolver] Cliente resolvido via Fallback Match: "${cliente.nomeEmpresa}" (Score: ${cliente.score.toFixed(2)})`);
      return cliente;
    }

    console.log('[ClienteResolver] Não foi possível mapear a pergunta a nenhum cliente cadastrado.');
    return null;
  } catch (err: any) {
    console.error('❌ Erro no resolveClienteFromQuestion:', err.message);
    return null;
  }
}
