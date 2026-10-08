import { Router } from 'express';
import { votesController } from '../controller/votes.controller.js';
import { guestAuth } from '../../../middlewares/guestAuth.middleware.js';
import {
  createRateLimiter,
  createActorRateLimiter,
} from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createVoteSchema } from '../validation/votes.validation.js';

const votesRoutes = Router();

// Voting is open to anyone. Anonymous voters are keyed to their device identity
// so stuffing still costs a fresh device, and the IP budget stays the backstop.
votesRoutes.post(
  '/',
  createRateLimiter(RATE_LIMITS.REACTION_IP),
  guestAuth({ enforceActive: true }),
  createActorRateLimiter(RATE_LIMITS.REACTION, RATE_LIMITS.REACTION_GUEST),
  validate({ body: createVoteSchema }),
  asyncHandler(votesController.vote.bind(votesController)),
);

export { votesRoutes };
