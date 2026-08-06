import { Request, Response, NextFunction, type CookieOptions } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { authService } from '../service/auth.service.js';
import { toLoginResponse } from '../types/auth.types.js';
import { env } from '../../../config/env.js';
import { ADMIN_SESSION_TTL_MS, ADMIN_TOKEN_COOKIE } from '../../../shared/constants/index.js';

function adminCookieOptions(): CookieOptions {
  // In production the frontend and API are on different origins, so the cookie
  // must be sent cross-site. SameSite=None (which requires Secure) is allowed
  // for both same-site and cross-site requests. In development we keep Lax so
  // cookies work over plain http://localhost.
  const crossSite = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
    maxAge: ADMIN_SESSION_TTL_MS,
    path: '/',
  };
}

class AuthController {
  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.cookie(ADMIN_TOKEN_COOKIE, result.token, adminCookieOptions());

    sendSuccess(res, toLoginResponse(result.admin), 'Login successful');
  }

  async logout(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    // Must use identical attributes to the set cookie (esp. SameSite), or
    // the clearing response won't match and the cookie won't be removed.
    res.clearCookie(ADMIN_TOKEN_COOKIE, adminCookieOptions());

    sendSuccess(res, null, 'Logged out');
  }

  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const admin = req.admin!;
    sendSuccess(res, { id: admin.adminId, email: admin.email, name: admin.name }, 'Admin profile');
  }
}

export const authController = new AuthController();
