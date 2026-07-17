import { Router } from 'express';
import { anonymousController } from '../controller/anonymous.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';

const anonymousRoutes = Router();

anonymousRoutes.use(anonymousIdentity());

anonymousRoutes.get('/me', asyncHandler(anonymousController.me.bind(anonymousController)));

export { anonymousRoutes };
