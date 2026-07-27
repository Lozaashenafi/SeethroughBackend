import { Router } from 'express';
import { reviewsController } from '../controller/reviews.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createReviewSchema, listReviewsQuerySchema, reviewPublicIdParamsSchema } from '../validation/reviews.validation.js';

const reviewsRoutes = Router();

// Public routes
reviewsRoutes.get(
  '/',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listReviewsQuerySchema }),
  asyncHandler(reviewsController.listByCompany.bind(reviewsController)),
);

reviewsRoutes.get(
  '/:publicId',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.getByPublicId.bind(reviewsController)),
);

reviewsRoutes.post(
  '/',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.REVIEW_CREATE),
  validate({ body: createReviewSchema }),
  asyncHandler(reviewsController.create.bind(reviewsController)),
);

// Admin-only routes
reviewsRoutes.get(
  '/admin/all',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(reviewsController.listAll.bind(reviewsController)),
);

reviewsRoutes.delete(
  '/:publicId',
  adminAuth(),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.delete.bind(reviewsController)),
);

export { reviewsRoutes };
