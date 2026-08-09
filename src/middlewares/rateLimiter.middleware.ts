import rateLimit from 'express-rate-limit';

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max ?? 100,
    message: {
      success: false,
      message: options.message ?? 'Too many requests, please try again later.',
    },
    keyGenerator: (req) => {
      // Key on the anonymous publicId ONLY when it represents a stable,
      // cookie-backed identity. A request that arrived without a valid cookie
      // pair gets a freshly-minted identity (isNewAnonymousIdentity), and keying
      // on that would give a cookie-rotating attacker a fresh budget on every
      // request. Such requests are limited by client IP instead. Cookie-less
      // clients are also limited by IP since their identity is minted per call.
      const hasStableIdentity = Boolean(req.anonymous?.publicId) && !req.isNewAnonymousIdentity;
      return hasStableIdentity ? (req.anonymous!.publicId as string) : (req.ip ?? 'unknown');
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
