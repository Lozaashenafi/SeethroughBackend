import { Router } from 'express';
import { votesController } from '../controller/votes.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createVoteSchema } from '../validation/votes.validation.js';

const votesRoutes = Router();

// Voting requires authenticated user. Same dual budget as reviews/comments.
votesRoutes.post(
  '/',
  userAuth({ required: true, enforceActive: true }),
  createRateLimiter(RATE_LIMITS.REACTION, { scope: 'user' }),
  createRateLimiter(RATE_LIMITS.REACTION_IP),
  validate({ body: createVoteSchema }),
  asyncHandler(votesController.vote.bind(votesController)),
);

export { votesRoutes };
