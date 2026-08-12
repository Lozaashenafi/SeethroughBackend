export const API_PREFIX = '/api/v1';

export const ANONYMOUS_COOKIE_NAME = 'anonymous_id';
export const ANONYMOUS_SESSION_COOKIE_NAME = 'anonymous_session';

export const ANONYMOUS_ID_LENGTH = 32;

export const ADMIN_TOKEN_COOKIE = 'admin_token';
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const RATE_LIMITS = {
  REVIEW_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 3 },
  COMPANY_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  COMMENT_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  REACTION: { windowMs: 24 * 60 * 60 * 1000, max: 50 },
  REPORT: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  DEFAULT: { windowMs: 15 * 60 * 1000, max: 100 },
} as const;
