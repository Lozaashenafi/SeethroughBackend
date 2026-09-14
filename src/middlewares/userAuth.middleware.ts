import { Request, Response, NextFunction } from 'express';
import { userAuthService } from '../modules/user-auth/service/userAuth.service.js';
import { userAuthRepository } from '../modules/user-auth/repository/userAuth.repository.js';
import { sendError } from '../shared/responses/index.js';
import { USER_TOKEN_COOKIE } from '../shared/constants/index.js';
import type { UserJwtPayload } from '../modules/user-auth/types/userAuth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserJwtPayload;
    }
  }
}

/**
 * Middleware that authenticates a user. Reads the JWT from either
 * the `user_token` httpOnly cookie or the `Authorization: Bearer <token>`
 * header. Attaches the decoded payload to `req.user`.
 *
 * Unlike `adminAuth`, this does NOT block unauthenticated requests — it
 * attaches the user if present and lets the route handler decide whether
 * authentication is required. Use `userAuth({ required: true })` to enforce it.
 *
 * `enforceActive` additionally rejects users an admin has blocked, or
 * temporarily restricted, so it belongs on the posting routes (reviews,
 * comments, votes, reports) — those users may still browse and log in.
 */
export function userAuth(options?: {
  required?: boolean;
  verifiedOnly?: boolean;
  adminOnly?: boolean;
  enforceActive?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookieToken = req.cookies?.[USER_TOKEN_COOKIE] as string | undefined;
      const authHeader = req.headers.authorization;
      const headerToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : undefined;

      const token = cookieToken || headerToken;

      if (!token) {
        if (options?.required || options?.adminOnly) {
          sendError(res, 'Authentication required. Please log in.', 401);
          return;
        }
        return next();
      }

      const payload = userAuthService.verifyToken(token);

      // The profile is only fetched when an option needs more than the JWT
      // claims carry (moderation state, email verification, role).
      let profile: Awaited<ReturnType<typeof userAuthRepository.findById>> = null;
      if (options?.verifiedOnly || options?.adminOnly || options?.enforceActive) {
        profile = await userAuthRepository.findById(payload.userId);
      }

      if (options?.enforceActive) {
        if (!profile) {
          sendError(res, 'Invalid or expired token. Please log in again.', 401);
          return;
        }
        if (profile.isBlocked) {
          sendError(
            res,
            'Your account has been blocked. You can no longer post reviews, comments or votes.',
            403,
          );
          return;
        }
        if (profile.tempBlockedUntil && profile.tempBlockedUntil.getTime() > Date.now()) {
          sendError(
            res,
            `Your account is temporarily restricted until ${profile.tempBlockedUntil.toISOString()}.`,
            403,
          );
          return;
        }
      }

      if (options?.verifiedOnly) {
        if (!profile || !profile.emailVerified) {
          sendError(res, 'Please verify your email before posting reviews.', 403);
          return;
        }
      }

      if (options?.adminOnly) {
        if (!profile || profile.role !== 'admin') {
          sendError(res, 'Admin access required.', 403);
          return;
        }
      }

      req.user = payload;
      next();
    } catch {
      if (options?.required || options?.adminOnly) {
        sendError(res, 'Invalid or expired token. Please log in again.', 401);
        return;
      }
      next();
    }
  };
}
