import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_ADMIN_EMAIL = 'admin@seethrough.com';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().optional(),
  ADMIN_EMAIL: z.string().email().default(DEFAULT_ADMIN_EMAIL),
  ADMIN_PASSWORD: z.string().min(8).max(72).default(DEFAULT_ADMIN_PASSWORD),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }

  const env = parsed.data;

  // Require a real admin password in production; the default is dev-only
  if (env.NODE_ENV === 'production' && env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_PASSWORD is required in production. ' +
        `Set it to a strong password and never use the default "${DEFAULT_ADMIN_PASSWORD}".`,
    );
  }

  // Require JWT_SECRET in production, provide a warning fallback in dev/test
  if (!env.JWT_SECRET) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
        'Set it to a long, random string. You can generate one with: ' +
        'openssl rand -base64 32',
      );
    }
    const fallback = 'dev-secret-do-not-use-in-production';
    console.warn(
      '⚠️  WARNING: JWT_SECRET not set. Using insecure development fallback. ' +
      'Set JWT_SECRET in your .env file for any non-local environment.',
    );
    return { ...env, JWT_SECRET: fallback };
  }

  return env as typeof env & { JWT_SECRET: string };
}

export const env = validateEnv();
