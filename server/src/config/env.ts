import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const hex64Regex = /^[0-9a-fA-F]{64}$/;

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória para conexão com o banco.'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL é obrigatória para migrações do Prisma.'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter no mínimo 32 caracteres.'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter no mínimo 32 caracteres.'),
  PII_ENCRYPTION_KEY_HEX: z
    .string()
    .regex(hex64Regex, 'PII_ENCRYPTION_KEY_HEX deve conter exatamente 64 caracteres hexadecimais (32 bytes).'),
  PII_HMAC_KEY_HEX: z
    .string()
    .regex(hex64Regex, 'PII_HMAC_KEY_HEX deve conter exatamente 64 caracteres hexadecimais (32 bytes).'),
  ENABLE_DEMO_ACCOUNTS: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('true'),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ [FAIL-FAST] Erro crítico nas variáveis de ambiente:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
