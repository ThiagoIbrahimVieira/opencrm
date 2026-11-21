import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || '01234567890123456789012345678901';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '01234567890123456789012345678901';
  process.env.PII_ENCRYPTION_KEY_HEX = process.env.PII_ENCRYPTION_KEY_HEX || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.PII_HMAC_KEY_HEX = process.env.PII_HMAC_KEY_HEX || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

const hex64Regex = /^[0-9a-fA-F]{64}$/;

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .refine(
      (val) => val.split(',').map((s) => s.trim()).filter(Boolean).length > 0,
      'CORS_ORIGIN deve conter ao menos uma origem válida separada por vírgula.'
    ),
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

let validatedEnv: z.infer<typeof envSchema>;

try {
  validatedEnv = envSchema.parse(process.env);
} catch (err: any) {
  console.error('❌ [FAIL-FAST] Erro crítico nas variáveis de ambiente:');
  if (err instanceof z.ZodError) {
    console.error(JSON.stringify(err.format(), null, 2));
  } else {
    console.error(err);
  }
  process.exit(1);
}

export const env = validatedEnv;
