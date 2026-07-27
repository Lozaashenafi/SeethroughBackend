import { Router } from 'express';
import { votesController } from '../controller/votes.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createVoteSchema } from '../validation/votes.validation.js';

const votesRoutes = Router();

votesRoutes.use(anonymousIdentity());

votesRoutes.post(
  '/',
  createRateLimiter(RATE_LIMITS.REACTION),
  validate({ body: createVoteSchema }),
  asyncHandler(votesController.vote.bind(votesController)),
);

export { votesRoutes };
