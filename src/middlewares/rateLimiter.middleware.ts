import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  /**
   * 'user' keys the counter on the authenticated account id (falling back to
   * IP for anonymous callers), so logging out or switching devices does not
   * reset a budget. 'ip' (default) keys on the client IP, which stops one
   * actor from exhausting an account-keyed budget through fresh accounts.
   * The posting routes run userAuth() before the limiter, so req.user is
   * already populated when a user-scoped limiter executes.
   */
  scope?: 'user' | 'ip';
}

/**
 * Accepts a RATE_LIMITS entry (window/max/message) plus optional overrides
 * (e.g. scope) so call sites can share a preset but vary the keying.
 */
export function createRateLimiter(
  options: RateLimiterOptions = {},
  overrides: Pick<RateLimiterOptions, 'scope'> = {},
) {
  const merged = { ...options, ...overrides };
  return rateLimit({
    windowMs: merged.windowMs ?? 15 * 60 * 1000,
    max: merged.max ?? 100,
    message: {
      success: false,
      message: merged.message ?? 'Too many requests, please try again later.',
    },
    keyGenerator: (req) => {
      if (merged.scope === 'user' && req.user?.userId) {
        return `user:${req.user.userId}`;
      }
      return (req.ip ?? 'unknown');
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Builds one limiter that dispatches to a tighter budget for anonymous guests
 * and a looser one for signed-in accounts. Must run after `guestAuth`, so that
 * `req.user` (and therefore the correct budget) is already resolved.
 */
export function createActorRateLimiter(
  userOptions: RateLimiterOptions,
  guestOptions: RateLimiterOptions,
) {
  const userLimiter = createRateLimiter(userOptions, { scope: 'user' });
  const guestLimiter = createRateLimiter(guestOptions, { scope: 'user' });

  return (req: Request, res: Response, next: NextFunction): void => {
    const limiter = req.user?.isGuest ? guestLimiter : userLimiter;
    limiter(req, res, next);
  };
}
