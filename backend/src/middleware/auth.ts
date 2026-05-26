import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Middleware para autenticação via JWT.
 * Verifica o token de acesso no cabeçalho Authorization ou nos cookies.
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  // Tenta extrair do Header Bearer ou dos cookies
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.cookies) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
  }

  try {
    const verified = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
    };
    
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
}
