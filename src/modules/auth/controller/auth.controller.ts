import { Request, Response, NextFunction, type CookieOptions } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { authService } from '../service/auth.service.js';
import { toLoginResponse } from '../types/auth.types.js';
import { env } from '../../../config/env.js';

const ADMIN_TOKEN_COOKIE = 'admin_token';
const ADMIN_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function adminCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
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
    res.clearCookie(ADMIN_TOKEN_COOKIE, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    sendSuccess(res, null, 'Logged out');
  }

  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const admin = req.admin!;
    sendSuccess(res, { id: admin.adminId, email: admin.email, name: admin.name }, 'Admin profile');
  }
}

export const authController = new AuthController();
