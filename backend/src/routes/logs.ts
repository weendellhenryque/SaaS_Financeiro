import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/logs
 * Retorna os logs de auditoria recentes do RAG para exibição no painel contábil.
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.queryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        cliente: {
          select: {
            nomeEmpresa: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.json(logs);
  } catch (err: any) {
    console.error('❌ Erro ao buscar logs de auditoria:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar logs contábeis.' });
  }
});

export default router;
