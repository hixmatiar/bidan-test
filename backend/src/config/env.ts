import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.toLowerCase() : value),
    z.enum(['true', 'false']).default('false'),
  )
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TZ: z.string().min(1).default('Asia/Jakarta'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_ENCRYPT: booleanFromEnv,
  DB_TRUST_CERT: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.toLowerCase() : value),
      z.enum(['true', 'false']).default('true'),
    )
    .transform((value) => value === 'true'),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(1800),
  MAX_FAILED_LOGIN: z.coerce.number().int().positive().default(5),
  LOCKOUT_DURATION: z.coerce.number().int().positive().default(900),
  OTP_TTL: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_PUBLIC: z.coerce.number().int().positive().default(10),
  WA_API_URL: z.string().url().default('https://example.invalid/wa'),
  WA_API_TOKEN: z.string().min(1).default('change-me'),
  CRON_REMINDER_H1: z.string().min(1).default('0 8 * * *'),
  CRON_INVENTORY_WEEKLY: z.string().min(1).default('0 7 * * 1'),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'ENV'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration -> ${details}`);
}

export const env = parsed.data;
export type Env = typeof env;
