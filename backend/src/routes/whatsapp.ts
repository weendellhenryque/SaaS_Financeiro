import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { getWhatsAppStatus } from '../services/whatsapp.js';

const router = Router();

/**
 * GET /api/whatsapp/status
 * Retorna o status de conexão atual do WhatsApp (CONNECTED, CONNECTING, DISCONNECTED)
 * e o QR Code em formato base64 DataURL (se ativo).
 */
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = getWhatsAppStatus();
    return res.json(status);
  } catch (err: any) {
    console.error('❌ Erro ao buscar status do WhatsApp:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar status do WhatsApp.' });
  }
});

export default router;
