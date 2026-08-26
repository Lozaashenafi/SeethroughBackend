import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  // Comma-separated browser origins allowed to call the API. MUST include your
  // deployed frontend origin (e.g. https://yourfrontend.vercel.app) or
  // cross-origin login/admin calls will be rejected.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,https://seethroght.vercel.app'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }

  const env = parsed.data;

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
