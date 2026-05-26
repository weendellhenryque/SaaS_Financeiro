import rateLimit from 'express-rate-limit';

/**
 * Limitador de taxa para rotas sensíveis (como Login e MFA)
 * Limita a 10 requisições a cada 5 minutos por IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // limite de 10 requisições por IP
  message: {
    error: 'Muitas tentativas de login a partir deste IP. Por favor, tente novamente após 5 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limitador de taxa global para a API contábil (evita abusos ou loops)
 * Limita a 200 requisições a cada 15 minutos por IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: {
    error: 'Limite de requisições excedido para a API. Por favor, tente novamente mais tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
