export const API_PREFIX = '/api/v1';

export const USER_TOKEN_COOKIE = 'user_token';
export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const RATE_LIMITS = {
  // Posting a review: the account budget stops one user from flooding; the
  // parallel IP budget stops one actor from flooding through many fresh
  // accounts. Both must pass for the request to go through.
  REVIEW_CREATE: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    message: 'You have reached the review limit for today. Please try again tomorrow.',
  },
  REVIEW_CREATE_IP: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 10,
    message: 'Too many reviews have been created from this network today. Please try again tomorrow.',
  },
  COMPANY_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  COMMENT_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  COMMENT_CREATE_IP: { windowMs: 24 * 60 * 60 * 1000, max: 60 },
  REACTION: { windowMs: 24 * 60 * 60 * 1000, max: 50 },
  REACTION_IP: { windowMs: 24 * 60 * 60 * 1000, max: 150 },
  REPORT: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  REPORT_IP: { windowMs: 24 * 60 * 60 * 1000, max: 30 },
  UPLOAD: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  DEFAULT: { windowMs: 15 * 60 * 1000, max: 100 },
} as const;
