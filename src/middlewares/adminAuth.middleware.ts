import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/service/auth.service.js';
import { sendError } from '../shared/responses/index.js';
import type { AdminJwtPayload } from '../modules/auth/types/auth.types.js';

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
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendError(res, 'Authentication required. Provide a Bearer token.', 401);
        return;
      }

      const token = authHeader.slice(7);
      if (!token) {
        sendError(res, 'Authentication required. Provide a Bearer token.', 401);
        return;
      }

      const payload = authService.verifyToken(token);
      req.admin = payload;
      next();
    } catch (error) {
      sendError(res, 'Invalid or expired token', 401);
    }
  };
}
