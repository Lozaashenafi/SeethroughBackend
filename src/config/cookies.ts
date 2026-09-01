import type { CookieOptions } from 'express';
import { env } from './env.js';

// 10-year cookie lifetime — effectively "forever". The browser will keep the
// anonymous identity as long as the user hasn't cleared cookies / localStorage.
// The server also issues a new session token when the existing one is stale, so
// the identity persists across indefinitely.
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export const cookieConfig: CookieOptions = {
  httpOnly: true,
  // Cross-origin production deployment requires SameSite=None (which forces
  // Secure). Lax keeps plain-http localhost working in development.
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: TEN_YEARS_MS,
  path: '/',
};
