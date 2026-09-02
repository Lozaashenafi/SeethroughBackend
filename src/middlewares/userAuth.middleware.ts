import { Request, Response, NextFunction } from 'express';
import { userAuthService } from '../modules/user-auth/service/userAuth.service.js';
import { userAuthRepository } from '../modules/user-auth/repository/userAuth.repository.js';
import { sendError } from '../shared/responses/index.js';
import type { UserJwtPayload } from '../modules/user-auth/types/userAuth.types.js';

const USER_TOKEN_COOKIE = 'user_token';

declare global {
  namespace Express {
    interface Request {
      user?: UserJwtPayload;
    }
  }
}

/**
 * Middleware that authenticates a regular user. Reads the JWT from either
 * the `user_token` httpOnly cookie or the `Authorization: Bearer <token>`
 * header. Attaches the decoded payload to `req.user`.
 *
 * Unlike `adminAuth`, this does NOT block unauthenticated requests — it
 * attaches the user if present and lets the route handler decide whether
 * authentication is required. Use `userAuth({ required: true })` to enforce it.
 */
export function userAuth(options?: { required?: boolean; verifiedOnly?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookieToken = req.cookies?.[USER_TOKEN_COOKIE] as
        | string
        | undefined;
      const authHeader = req.headers.authorization;
      const headerToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : undefined;

      const token = cookieToken || headerToken;

      if (!token) {
        if (options?.required) {
          sendError(
            res,
            'Authentication required. Please log in.',
            401,
          );
          return;
        }
        // No token — continue without user context
        return next();
      }

      const payload = userAuthService.verifyToken(token);

      // If verifiedOnly is requested, check the DB for email_verified status
      if (options?.verifiedOnly) {
        const profile = await userAuthRepository.findById(payload.userId);
        if (!profile || !profile.emailVerified) {
          sendError(
            res,
            'Please verify your email before posting reviews. Check your inbox for the verification link.',
            403,
          );
          return;
        }
      }

      req.user = payload;
      next();
    } catch {
      if (options?.required) {
        sendError(res, 'Invalid or expired token. Please log in again.', 401);
        return;
      }
      // Invalid token — continue without user context
      next();
    }
  };
}
