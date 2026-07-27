import type { CorsOptions } from 'cors';
import { env } from './env.js';

function isValidOrigin(origin: string): boolean {
  if (origin === '') return false;
  try {
    new URL(origin);
    return true;
  } catch {
    return false;
  }
}

export const corsConfig: CorsOptions = {
  origin: env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(isValidOrigin),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
