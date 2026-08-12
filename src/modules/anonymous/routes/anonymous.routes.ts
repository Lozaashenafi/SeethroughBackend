import { Router } from 'express';
import { anonymousController } from '../controller/anonymous.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import {
  listIdentitiesQuerySchema,
  activityQuerySchema,
  tempBlockSchema,
  updateNicknameSchema,
} from '../validation/anonymous.validation.js';

const anonymousRoutes = Router();

// Public - get own identity
anonymousRoutes.use(anonymousIdentity());

anonymousRoutes.get(
  '/me',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.me.bind(anonymousController)),
);

anonymousRoutes.patch(
  '/me/nickname',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ body: updateNicknameSchema }),
  asyncHandler(anonymousController.updateNickname.bind(anonymousController)),
);

// Admin-only routes
anonymousRoutes.get(
  '/admin/list',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listIdentitiesQuerySchema }),
  asyncHandler(anonymousController.list.bind(anonymousController)),
);

anonymousRoutes.patch(
  '/admin/:publicId/block',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.block.bind(anonymousController)),
);

anonymousRoutes.patch(
  '/admin/:publicId/unblock',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.unblock.bind(anonymousController)),
);

anonymousRoutes.patch(
  '/admin/:publicId/temp-block',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ body: tempBlockSchema }),
  asyncHandler(anonymousController.tempBlock.bind(anonymousController)),
);

anonymousRoutes.patch(
  '/admin/:publicId/clear-temp-block',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.clearTempBlock.bind(anonymousController)),
);

anonymousRoutes.get(
  '/admin/:publicId/activity',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: activityQuerySchema }),
  asyncHandler(anonymousController.getActivity.bind(anonymousController)),
);

anonymousRoutes.get(
  '/admin/:publicId/reviews',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.getReviews.bind(anonymousController)),
);

// Permanently delete an identity and ALL of its content (reviews, comments,
// votes, reports). The identity's cookies become orphaned, so the same browser
// is minted a fresh identity on its next visit.
anonymousRoutes.delete(
  '/admin/:publicId',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.deleteIdentity.bind(anonymousController)),
);

export { anonymousRoutes };
