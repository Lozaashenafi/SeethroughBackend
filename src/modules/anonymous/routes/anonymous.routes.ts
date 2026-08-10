import { Router } from 'express';
import { anonymousController } from '../controller/anonymous.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { listIdentitiesQuerySchema, tempBlockSchema } from '../validation/anonymous.validation.js';

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
  asyncHandler(anonymousController.regenerateNickname.bind(anonymousController)),
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

export { anonymousRoutes };
