export const API_PREFIX = '/api/v1';

export const USER_TOKEN_COOKIE = 'user_token';
export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const RATE_LIMITS = {
  REVIEW_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 3 },
  COMPANY_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  COMMENT_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  REACTION: { windowMs: 24 * 60 * 60 * 1000, max: 50 },
  REPORT: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  UPLOAD: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  DEFAULT: { windowMs: 15 * 60 * 1000, max: 100 },
} as const;
