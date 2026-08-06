import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/service/auth.service.js';
import { sendError } from '../shared/responses/index.js';
import type { AdminJwtPayload } from '../modules/auth/types/auth.types.js';
import { ADMIN_TOKEN_COOKIE } from '../shared/constants/index.js';

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

export function adminAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const cookieToken = req.cookies?.[ADMIN_TOKEN_COOKIE] as string | undefined;
      const authHeader = req.headers.authorization;
      const headerToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : undefined;

      const token = cookieToken || headerToken;
      if (!token) {
        sendError(res, 'Authentication required. Provide a Bearer token.', 401);
        return;
      }

      const payload = authService.verifyToken(token);
      req.admin = payload;
      next();
    } catch {
      sendError(res, 'Invalid or expired token', 401);
    }
  };
}
