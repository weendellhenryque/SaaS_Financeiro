import { z } from 'zod';
import 'dotenv/config';
import path from 'path';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  PORT: z.coerce.number().default(5000),
  PUBLIC_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('2h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('14d'),
  COOKIE_SECURE: z.coerce.boolean().default(true),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string(),
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  EMBEDDING_MODEL: z.string().default('text-embedding-004'),
  WHATSAPP_WHITELIST: z.string().transform((s) =>
    s.split(',').map((x) => x.trim()).filter(Boolean)
  ),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.format());
  process.exit(1);
}

// Garante que o caminho da credencial do Google seja absoluto
const rawCredentialsPath = parsed.data.GOOGLE_APPLICATION_CREDENTIALS;
const absoluteCredentialsPath = path.isAbsolute(rawCredentialsPath)
  ? rawCredentialsPath
  : path.resolve(process.cwd(), rawCredentialsPath);

// Atualiza no process.env para que as bibliotecas oficiais do Google leiam o caminho absoluto correto
process.env.GOOGLE_APPLICATION_CREDENTIALS = absoluteCredentialsPath;

export const env = {
  ...parsed.data,
  GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath,
};

