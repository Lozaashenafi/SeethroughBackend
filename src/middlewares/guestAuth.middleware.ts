import { Request, Response, NextFunction } from 'express';
import { userAuthRepository } from '../modules/user-auth/repository/userAuth.repository.js';
import { userAuthService } from '../modules/user-auth/service/userAuth.service.js';
import { sendError } from '../shared/responses/index.js';
import {
  USER_TOKEN_COOKIE,
  GUEST_TOKEN_COOKIE,
  GUEST_SESSION_TTL_MS,
} from '../shared/constants/index.js';
import type { UserJwtPayload } from '../modules/user-auth/types/userAuth.types.js';

/**
 * Resolves the *actor* for a route that anonymous visitors are allowed to use.
 *
 * Unlike `userAuth`, this middleware never rejects an unauthenticated request:
 *
 *   1. A valid account token (`user_token` cookie or Bearer header) wins and is
 *      attached to `req.user`, with the same `enforceActive` / verified checks
 *      available to callers.
 *   2. Otherwise an existing signed device cookie (`guest_device`) is reused.
 *   3. Otherwise a fresh guest identity is minted: a real `users` row with no
 *      email, password or verification, plus the long-lived device cookie.
 *
 * The guest identity is what makes anonymous content moderatable — it owns the
 * review/comment/vote, can be blind-banned, and counts against its own per-device
 * budget — without ever being tied to a real person.
 *
 * Route order matters: run the IP-scoped rate limiter BEFORE this middleware so
 * a flood cannot mint guest rows, and run any account-scoped limiter AFTER it so
 * `req.user` is populated when the counter key is chosen.
 */
export function guestAuth(options?: {
  enforceActive?: boolean;
  /** Accounts must have a verified email; guests are exempt (they are moderated). */
  requireVerifiedUser?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. A real account token wins when present and valid.
      const token = extractAccountToken(req);
      if (token) {
        const payload = tryVerify(token);
        if (payload && !payload.isGuest && payload.role !== 'guest') {
          const profile = await userAuthRepository.findById(payload.userId);
          if (!profile) {
            sendError(res, 'Invalid or expired token. Please log in again.', 401);
            return;
          }
          if (options?.enforceActive) {
            const blocked = activeCheck(profile);
            if (blocked) {
              sendError(res, blocked.message, blocked.status);
              return;
            }
          }
          if (options?.requireVerifiedUser && !profile.emailVerified) {
            sendError(res, 'Please verify your email before posting reviews.', 403);
            return;
          }
          req.user = payload;
          return next();
        }
      }

      // 2. An existing guest device reuses its identity.
      const guestToken = req.cookies?.[GUEST_TOKEN_COOKIE] as string | undefined;
      if (guestToken) {
        const guest = tryVerify(guestToken);
        if (guest && (guest.isGuest || guest.role === 'guest')) {
          const profile = await userAuthRepository.findById(guest.userId);
          if (profile) {
            if (options?.enforceActive) {
              const restricted = activeCheck(profile);
              if (restricted) {
                sendError(res, restricted.message, restricted.status);
                return;
              }
            }
            req.user = guest;
            return next();
          }
          // The row is gone — fall through and mint a fresh identity.
        }
      }

      // 3. First anonymous post from this device: mint a guest identity.
      const created = await userAuthRepository.createGuest();
      setGuestCookie(res, userAuthService.generateGuestToken(created.id));
      req.user = {
        jti: 'guest',
        userId: created.id,
        email: '',
        displayName: 'Anonymous',
        role: 'guest',
        isGuest: true,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function extractAccountToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[USER_TOKEN_COOKIE] as string | undefined;
  const authHeader = req.headers.authorization;
  const headerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  return cookieToken || headerToken;
}

function tryVerify(token: string): UserJwtPayload | null {
  try {
    return userAuthService.verifyToken(token);
  } catch {
    return null;
  }
}

/** Shared block/temp-block check for both accounts and guest devices. */
function activeCheck(profile: {
  isBlocked: boolean;
  tempBlockedUntil: Date | null;
}): { status: number; message: string } | null {
  if (profile.isBlocked) {
    return {
      status: 403,
      message:
        'Your account has been blocked. You can no longer post reviews, comments or votes.',
    };
  }
  if (profile.tempBlockedUntil && profile.tempBlockedUntil.getTime() > Date.now()) {
    return {
      status: 403,
      message: `Your account is temporarily restricted until ${profile.tempBlockedUntil.toISOString()}.`,
    };
  }
  return null;
}

function setGuestCookie(res: Response, token: string): void {
  res.cookie(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: GUEST_SESSION_TTL_MS,
    path: '/',
  });
}
