export const API_PREFIX = '/api/v1';

export const USER_TOKEN_COOKIE = 'user_token';
export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Anonymous (no-account) posters are identified by a long-lived signed device
// cookie. Losing it just means a fresh guest identity — the per-device budget
// below is a soft limit, so the IP budgets remain the hard backstop.
export const GUEST_TOKEN_COOKIE = 'guest_device';
export const GUEST_SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

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
  // Anonymous posters get a much smaller per-device budget than accounts. Their
  // reviews are pre-moderated anyway, so this mainly caps queue spam.
  REVIEW_CREATE_GUEST: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 2,
    message: 'You have reached the anonymous review limit for today. Create an account to post more.',
  },
  COMMENT_CREATE_GUEST: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    message: 'You have reached the anonymous comment limit for today. Create an account to comment more.',
  },
  REACTION_GUEST: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 20,
    message: 'You have reached the anonymous voting limit for today. Create an account to vote more.',
  },
  COMPANY_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  COMMENT_CREATE: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  COMMENT_CREATE_IP: { windowMs: 24 * 60 * 60 * 1000, max: 60 },
  REACTION: { windowMs: 24 * 60 * 60 * 1000, max: 50 },
  REACTION_IP: { windowMs: 24 * 60 * 60 * 1000, max: 150 },
  REPORT: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  REPORT_IP: { windowMs: 24 * 60 * 60 * 1000, max: 30 },
  UPLOAD: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  // AI title suggestions — small daily budget because each call costs money.
  TITLE_SUGGEST: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 15,
    message: 'You have reached the AI title suggestion limit for today. You can still write the title yourself.',
  },
  // Anonymous posters get a smaller share of the AI budget than accounts.
  TITLE_SUGGEST_GUEST: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    message:
      'You have reached the anonymous AI title suggestion limit for today. Create an account for more, or write the title yourself.',
  },
  // Hard backstop for the paid AI endpoint. A per-device budget alone is not a
  // spend cap: one actor can mint unlimited guest identities and take 5 more
  // calls with each, so this bounds the whole network regardless.
  TITLE_SUGGEST_IP: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 40,
    message:
      'Too many AI title suggestions from this network today. You can still write the title yourself.',
  },
  DEFAULT: { windowMs: 15 * 60 * 1000, max: 100 },
} as const;
