import { Router } from 'express';
import { commentsController } from '../controller/comments.controller.js';
import { guestAuth } from '../../../middlewares/guestAuth.middleware.js';
import {
  createRateLimiter,
  createActorRateLimiter,
} from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createCommentSchema, listCommentsQuerySchema } from '../validation/comments.validation.js';

const commentsRoutes = Router();

// Reading comments is public
commentsRoutes.get(
  '/review/:reviewPublicId',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listCommentsQuerySchema }),
  asyncHandler(commentsController.listByReview.bind(commentsController)),
);

// Posting comments is open to anyone. Anonymous comments use a tighter
// per-device budget; the IP budget runs first so a flood cannot mint guests.
commentsRoutes.post(
  '/',
  createRateLimiter(RATE_LIMITS.COMMENT_CREATE_IP),
  guestAuth({ enforceActive: true }),
  createActorRateLimiter(RATE_LIMITS.COMMENT_CREATE, RATE_LIMITS.COMMENT_CREATE_GUEST),
  validate({ body: createCommentSchema }),
  asyncHandler(commentsController.create.bind(commentsController)),
);

export { commentsRoutes };
