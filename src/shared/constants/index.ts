export const API_PREFIX = '/api/v1';

export const ANONYMOUS_COOKIE_NAME = 'anonymous_id';

export const ANONYMOUS_ID_LENGTH = 32;

export const RATE_LIMITS = {
  REVIEW_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 3 },
  COMMENT_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  REACTION: { windowMs: 24 * 60 * 60 * 1000, max: 1 },
  REPORT: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  DEFAULT: { windowMs: 15 * 60 * 1000, max: 100 },
} as const;

export const IDENTITY_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  FLAGGED: 'flagged',
} as const;
