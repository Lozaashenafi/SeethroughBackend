import type { CookieOptions } from 'express';
import { env } from './env.js';

export const cookieConfig: CookieOptions = {
  httpOnly: true,
  // Cross-origin production deployment requires SameSite=None (which forces
  // Secure). Lax keeps plain-http localhost working in development.
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 365 * 24 * 60 * 60 * 1000,
  path: '/',
};
