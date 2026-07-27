import { Router } from 'express';
import { anonymousController } from '../controller/anonymous.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';

const anonymousRoutes = Router();

// Public - get own identity
anonymousRoutes.use(anonymousIdentity());

anonymousRoutes.get(
  '/me',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(anonymousController.me.bind(anonymousController)),
);

// Admin-only routes
anonymousRoutes.get(
  '/admin/list',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
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

export { anonymousRoutes };
