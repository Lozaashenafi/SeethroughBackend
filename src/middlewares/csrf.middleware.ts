import { randomBytes } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Methods that must be protected against CSRF.
const STATE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Double-Submit Cookie CSRF protection.
 *
 * On every response, a random CSRF token is set as a cookie (readable by JS).
 * For state-changing methods (POST/PUT/PATCH/DELETE), the client must echo the
 * same token in the `X-CSRF-Token` header. Browsers enforce same-origin policy
 * on headers, so a cross-origin site can read the cookie but cannot set the
 * header — blocking forged requests.
 */
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Always set the CSRF cookie so the client can read it and echo it back.
    // httpOnly: false so JavaScript can read it.
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });
    }

    // Only validate on state-changing methods.
    if (!STATE_METHODS.has(req.method)) {
      return next();
    }

    // Skip CSRF for auth endpoints — the user has no CSRF cookie to echo yet
    // on first visit. These endpoints are protected by rate limiting instead.
    // Use endsWith because req.path includes the /api/v1 prefix.
    const isAuthEndpoint =
      req.path.endsWith('/auth/login') ||
      req.path.endsWith('/user/login') ||
      req.path.endsWith('/user/register') ||
      req.path.endsWith('/user/google');
    if (isAuthEndpoint) {
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      logger.warn(
        { path: req.path, method: req.method },
        'CSRF token mismatch',
      );
      res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token.',
      });
      return;
    }

    next();
  };
}
