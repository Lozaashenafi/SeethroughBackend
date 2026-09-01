import { Request, Response, NextFunction, type CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { sendSuccess } from '../../../shared/responses/index.js';
import { authService } from '../service/auth.service.js';
import { toLoginResponse } from '../types/auth.types.js';
import { env } from '../../../config/env.js';
import { tokenBlocklist } from '../../../shared/utils/tokenBlocklist.js';
import { ADMIN_SESSION_TTL_MS, ADMIN_TOKEN_COOKIE } from '../../../shared/constants/index.js';
import type { AdminJwtPayload } from '../types/auth.types.js';

function adminCookieOptions(): CookieOptions {
  const crossSite = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
    maxAge: ADMIN_SESSION_TTL_MS,
    path: '/',
  };
}

function clearAdminCookieOptions(): CookieOptions {
  const crossSite = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
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

  async logout(req: Request, res: Response, _next: NextFunction): Promise<void> {
    // Revoke the JWT server-side so a stolen token can't be used after logout.
    const cookieToken = req.cookies?.[ADMIN_TOKEN_COOKIE] as string | undefined;
    if (cookieToken) {
      try {
        const decoded = jwt.decode(cookieToken) as (AdminJwtPayload & { exp?: number }) | null;
        if (decoded?.jti) {
          const expiresAtMs = decoded.exp ? decoded.exp * 1000 : Date.now() + ADMIN_SESSION_TTL_MS;
          tokenBlocklist.revoke(decoded.jti, expiresAtMs);
        }
      } catch {
        // Token is malformed — nothing to revoke, just clear the cookie.
      }
    }

    res.clearCookie(ADMIN_TOKEN_COOKIE, clearAdminCookieOptions());

    sendSuccess(res, null, 'Logged out');
  }

  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const admin = req.admin!;
    sendSuccess(res, { id: admin.adminId, email: admin.email, name: admin.name }, 'Admin profile');
  }
}

export const authController = new AuthController();
