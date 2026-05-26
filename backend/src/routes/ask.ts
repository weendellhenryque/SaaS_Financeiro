import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { resolveClienteFromQuestion } from '../services/clienteResolver.js';
import { askRAG } from '../services/rag.js';
import { QueryChannel } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const router = Router();

/**
 * POST /api/ask
 * Endpoint RAG principal. Executa busca vetorial cosseno e consolida com o Gemini.
 * Se clienteId não for fornecido, resolve fuzzy a partir do teor da pergunta.
 */
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { question, clienteId } = req.body;
  const user = req.user!;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'A pergunta (question) é obrigatória.' });
  }

  try {
    let resolvedClienteId = clienteId;
    let resolvedClienteName = '';

    // 1. Se clienteId não for fornecido, tenta extrair fuzzy da pergunta via LLM + GIN index
    if (!resolvedClienteId) {
      console.log(`[API Ask] Resolvendo cliente fuzzy para pergunta: "${question}"`);
      const resolvedCliente = await resolveClienteFromQuestion(question);
      
      if (!resolvedCliente) {
        return res.json({
          resolved: false,
          answer: 'Olá! Não consegui identificar de qual empresa você está falando na sua pergunta. Poderia especificar o nome do cliente?',
          sources: [],
          latencyMs: 0,
        });
      }
      
      resolvedClienteId = resolvedCliente.id;
      resolvedClienteName = resolvedCliente.nomeEmpresa;
    } else {
      // Se fornecido, apenas valida a existência
      const cliente = await prisma.cliente.findUnique({
        where: { id: resolvedClienteId },
      });
      
      if (!cliente || !cliente.isActive) {
        return res.status(404).json({ error: 'Cliente não encontrado ou inativo.' });
      }
      
      resolvedClienteName = cliente.nomeEmpresa;
    }

    // 2. Chamar o Pipeline RAG consolidado
    console.log(`[API Ask] Executando RAG para "${resolvedClienteName}" (clienteId: ${resolvedClienteId})`);
    
    const ragResult = await askRAG(
      user.id,
      question,
      resolvedClienteId,
      resolvedClienteName,
      QueryChannel.DASHBOARD
    );

    return res.json({
      resolved: true,
      cliente: {
        id: resolvedClienteId,
        nomeEmpresa: resolvedClienteName,
      },
      ...ragResult,
    });
  } catch (err: any) {
    console.error('❌ Erro no endpoint ask:', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar pergunta RAG.' });
  }
});

export default router;
