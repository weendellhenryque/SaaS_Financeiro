import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/clientes
 * Lista todos os clientes ativos, com suporte a busca fuzzy no nome da empresa.
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { search } = req.query;

  try {
    if (search && typeof search === 'string') {
      // Busca fuzzy usando pg_trgm similarity no Postgres
      const resolved: any[] = await prisma.$queryRaw`
        SELECT 
          "id", "driveFolderId", "nomeEmpresa", "cnpj", "isActive", "createdAt", "updatedAt",
          similarity(unaccent("nomeEmpresa"), unaccent(${search})) as score
        FROM "Cliente"
        WHERE "isActive" = true
          AND similarity(unaccent("nomeEmpresa"), unaccent(${search})) >= 0.10
        ORDER BY score DESC
      `;
      return res.json(resolved);
    }

    // Retorna todos os clientes ordenados alfabeticamente
    const clientes = await prisma.cliente.findMany({
      where: { isActive: true },
      orderBy: { nomeEmpresa: 'asc' },
    });
    
    return res.json(clientes);
  } catch (err: any) {
    console.error('❌ Erro ao buscar clientes:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

export default router;
