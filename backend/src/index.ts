import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { prisma } from './db/prisma.js';

// Routers
import authRouter from './routes/auth.js';
import clientesRouter from './routes/clientes.js';
import filesRouter from './routes/files.js';
import askRouter from './routes/ask.js';
import whatsappRouter from './routes/whatsapp.js';
import logsRouter from './routes/logs.js';
import { initWhatsApp } from './services/whatsapp.js';

const app = express();

// 1. Segurança Hardening com Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 2. CORS com origem restrita ao Frontend
app.use(
  cors({
    origin: [env.PUBLIC_URL, 'http://localhost:5173'], // suporta localhost dev e prod
    credentials: true, // Obrigatório para cookies HttpOnly
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Middlewares utilitários
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// 4. Rate Limiter Global para a API
app.use('/api', globalRateLimiter);

// 5. Mapeamento de Rotas
app.use('/api/auth', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/files', filesRouter);
app.use('/api/ask', askRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/logs', logsRouter);

// Rota de Health Check do sistema (resolução de problemas e monitoramento)
app.get('/health', async (req, res) => {
  try {
    // Testa ping simples no banco
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date(),
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date(),
    });
  }
});

// Middleware de Tratamento de Erros Genéricos
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Erro não tratado:', err.stack || err.message);
  return res.status(500).json({
    error: 'Ocorreu um erro interno no servidor contábil.',
  });
});

// Inicialização do Servidor
app.listen(env.PORT, async () => {
  console.log(`\n🚀 [Backend RAG] Servidor rodando na porta ${env.PORT}`);
  console.log(`🌐 URL Pública Configurada: ${env.PUBLIC_URL}`);
  console.log(`🔧 Modo: ${env.NODE_ENV}\n`);

  // Inicializa o Bot do WhatsApp em segundo plano
  try {
    console.log('📱 Inicializando serviço de WhatsApp (Baileys)...');
    await initWhatsApp();
  } catch (err: any) {
    console.error('❌ Falha ao inicializar WhatsApp:', err.message);
  }
});

export default app;
