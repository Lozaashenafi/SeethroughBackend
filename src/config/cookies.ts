import type { CookieOptions } from 'express';
import { env } from './env.js';

export const cookieConfig: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 365 * 24 * 60 * 60 * 1000,
  path: '/',
};
