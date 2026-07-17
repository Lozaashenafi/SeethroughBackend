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
      return req.anonymous?.publicId ?? req.ip ?? 'unknown';
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
