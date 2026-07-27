import { Router } from 'express';
import { commentsController } from '../controller/comments.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createCommentSchema } from '../validation/comments.validation.js';

const commentsRoutes = Router();

commentsRoutes.use(anonymousIdentity());

commentsRoutes.get(
  '/review/:reviewPublicId',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  asyncHandler(commentsController.listByReview.bind(commentsController)),
);

commentsRoutes.post(
  '/',
  createRateLimiter(RATE_LIMITS.COMMENT_CREATE),
  validate({ body: createCommentSchema }),
  asyncHandler(commentsController.create.bind(commentsController)),
);

export { commentsRoutes };
