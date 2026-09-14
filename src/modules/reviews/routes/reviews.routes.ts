import { Router } from 'express';
import { reviewsController } from '../controller/reviews.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import {
  createReviewSchema,
  updateReviewSchema,
  listReviewsQuerySchema,
  reviewPublicIdParamsSchema,
  moderateReviewSchema,
} from '../validation/reviews.validation.js';

const reviewsRoutes = Router();

// Public routes
reviewsRoutes.get(
  '/',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listReviewsQuerySchema }),
  asyncHandler(reviewsController.listByCompany.bind(reviewsController)),
);

reviewsRoutes.get(
  '/:publicId',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.getByPublicId.bind(reviewsController)),
);

// Tag ids for a review (used to prefill the edit form).
reviewsRoutes.get(
  '/:publicId/tags',
  userAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.getTags.bind(reviewsController)),
);

// Edit your own review. Ownership is checked in the service (404 for others).
reviewsRoutes.put(
  '/:publicId',
  userAuth({ required: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema, body: updateReviewSchema }),
  asyncHandler(reviewsController.update.bind(reviewsController)),
);

// Create a review — requires authenticated user with verified email
reviewsRoutes.post(
  '/',
  userAuth({ required: true, verifiedOnly: true, enforceActive: true }),
  createRateLimiter(RATE_LIMITS.REVIEW_CREATE),
  validate({ body: createReviewSchema }),
  asyncHandler(reviewsController.create.bind(reviewsController)),
);

// Admin-only routes
reviewsRoutes.get(
  '/admin/all',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listReviewsQuerySchema }),
  asyncHandler(reviewsController.listAll.bind(reviewsController)),
);

reviewsRoutes.get(
  '/admin/:publicId',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.adminGetByPublicId.bind(reviewsController)),
);

reviewsRoutes.patch(
  '/admin/:publicId/status',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema, body: moderateReviewSchema }),
  asyncHandler(reviewsController.moderate.bind(reviewsController)),
);

reviewsRoutes.delete(
  '/:publicId',
  userAuth({ adminOnly: true }),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.delete.bind(reviewsController)),
);

export { reviewsRoutes };
