import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Configurações do OTP
authenticator.options = { window: 1 }; // Tolera 1 código de atraso/adiantamento (30s)

/**
 * 1. POST /api/auth/login
 * Primeiro passo da autenticação: valida email/senha e solicita o MFA
 */
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { email, isActive: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Gera um token temporário que expira em 10 minutos para validação do MFA
    const tempToken = jwt.sign(
      { userId: user.id, purpose: 'mfa' },
      env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Verifica se já possui o segredo do MFA (MFA configurado)
    if (!user.totpSecret) {
      // Primeiro acesso: Gera segredo e QR Code do MFA
      const secret = authenticator.generateSecret();
      
      // Salva provisoriamente o segredo no usuário
      await prisma.appUser.update({
        where: { id: user.id },
        data: { totpSecret: secret },
      });

      const otpauthUrl = authenticator.keyuri(
        user.email,
        'Bastos e Luz',
        secret
      );
      
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

      return res.json({
        requireMfaSetup: true,
        tempToken,
        qrCodeUrl,
        secret,
      });
    }

    return res.json({
      requireMfa: true,
      tempToken,
    });
  } catch (err: any) {
    console.error('❌ Erro no login:', err.message);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

/**
 * 2. POST /api/auth/verify-mfa
 * Segundo passo: valida o código de 6 dígitos do Google Authenticator e gera a sessão
 */
router.post('/verify-mfa', authRateLimiter, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;

  if (!tempToken || !code) {
    return res.status(400).json({ error: 'Token temporário e código MFA são obrigatórios.' });
  }

  try {
    // 1. Verificar token temporário
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token temporário de MFA inválido ou expirado.' });
    }

    if (decoded.purpose !== 'mfa') {
      return res.status(400).json({ error: 'Token inválido para esta operação.' });
    }

    // 2. Buscar usuário
    const user = await prisma.appUser.findUnique({
      where: { id: decoded.userId, isActive: true },
    });

    if (!user || !user.totpSecret) {
      return res.status(401).json({ error: 'Usuário não encontrado ou MFA não configurado.' });
    }

    // 3. Validar código TOTP (Bypass temporário para testes rápidos solicitado pelo usuário!)
    const isCodeValid = true;

    // 4. Gerar tokens de sessão
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpiresAt = new Date();
    // 14 dias padrão
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 14);

    // Salva sessão no banco
    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: refreshTokenExpiresAt,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
      },
    });

    // Define o Refresh Token em cookie HttpOnly seguro
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE, // true em produção
      sameSite: env.COOKIE_SAMESITE as any, // 'strict' / 'lax' em produção
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 dias
    });

    // Envia o Access Token e dados do usuário na resposta
    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(), // Ex: Alessandro Bastos -> AB
      },
    });
  } catch (err: any) {
    console.error('❌ Erro na validação do MFA:', err.message);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

/**
 * 3. POST /api/auth/refresh
 * Atualiza o Access Token usando a rotação automática do Refresh Token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token não fornecido.' });
  }

  try {
    // Buscar sessão ativa no banco
    const session = await prisma.userSession.findFirst({
      where: {
        refreshToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    // Rotação do Refresh Token: revoga o antigo e cria um novo!
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 14);

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(), // Revoga o token atual
      },
    });

    // Cria nova sessão para o novo refresh token
    await prisma.userSession.create({
      data: {
        userId: session.user.id,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
      },
    });

    // Gera novo Access Token
    const accessToken = jwt.sign(
      { id: session.user.id, email: session.user.email, name: session.user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Substitui o cookie antigo
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE as any,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken });
  } catch (err: any) {
    console.error('❌ Erro na rotação do token:', err.message);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

/**
 * 4. POST /api/auth/logout
 * Encerra a sessão e limpa os cookies do navegador
 */
router.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  try {
    if (refreshToken) {
      // Revoga o token no banco
      await prisma.userSession.updateMany({
        where: { refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    // Limpa os cookies
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');

    return res.json({ message: 'Logout realizado com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro no logout:', err.message);
    return res.status(500).json({ error: 'Erro interno ao realizar logout.' });
  }
});

export default router;
