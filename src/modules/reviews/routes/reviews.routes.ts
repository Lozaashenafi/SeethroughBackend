import { Router } from 'express';
import { reviewsController } from '../controller/reviews.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { guestAuth } from '../../../middlewares/guestAuth.middleware.js';
import {
  createRateLimiter,
  createActorRateLimiter,
} from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import {
  createReviewSchema,
  updateReviewSchema,
  listReviewsQuerySchema,
  reviewPublicIdParamsSchema,
  moderateReviewSchema,
  banAuthorSchema,
  suggestTitleSchema,
} from '../validation/reviews.validation.js';

const reviewsRoutes = Router();

// AI title suggestion. Every call costs money, so it carries a tight daily
// budget — smaller for anonymous guests than for accounts, plus a network-wide
// cap that holds no matter how many guest identities one actor mints. Open to
// anonymous posters because they can now write reviews, and a login wall on
// the title button inside an otherwise anonymous form is a dead end.
reviewsRoutes.post(
  '/suggest-title',
  createRateLimiter(RATE_LIMITS.TITLE_SUGGEST_IP),
  guestAuth({ enforceActive: true }),
  createActorRateLimiter(RATE_LIMITS.TITLE_SUGGEST, RATE_LIMITS.TITLE_SUGGEST_GUEST),
  validate({ body: suggestTitleSchema }),
  asyncHandler(reviewsController.suggestTitle.bind(reviewsController)),
);

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

// Create a review. A signed-in account publishes directly (and must have a
// verified email); anyone else may post anonymously, in which case the review
// is held for moderation and the device gets a much smaller budget. The IP
// budget runs first so a flood cannot mint guest identities.
reviewsRoutes.post(
  '/',
  createRateLimiter(RATE_LIMITS.REVIEW_CREATE_IP),
  guestAuth({ enforceActive: true, requireVerifiedUser: true }),
  createActorRateLimiter(RATE_LIMITS.REVIEW_CREATE, RATE_LIMITS.REVIEW_CREATE_GUEST),
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

// Blind ban — blocks the author of the review. No identity is ever returned.
reviewsRoutes.patch(
  '/admin/:publicId/ban-author',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema, body: banAuthorSchema }),
  asyncHandler(reviewsController.banAuthor.bind(reviewsController)),
);

// Blind unban — the inverse, so a mistaken ban can be undone from the review
// it was applied on. Still returns no identity.
reviewsRoutes.patch(
  '/admin/:publicId/unban-author',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reviewPublicIdParamsSchema, body: banAuthorSchema }),
  asyncHandler(reviewsController.unbanAuthor.bind(reviewsController)),
);

reviewsRoutes.delete(
  '/:publicId',
  userAuth({ adminOnly: true }),
  validate({ params: reviewPublicIdParamsSchema }),
  asyncHandler(reviewsController.delete.bind(reviewsController)),
);

export { reviewsRoutes };
