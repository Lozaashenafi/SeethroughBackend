import { Router } from 'express';
import { healthRoutes } from '../modules/health/routes/health.routes.js';
import { anonymousRoutes } from '../modules/anonymous/routes/anonymous.routes.js';

const router = Router();

router.use('/api/v1/health', healthRoutes);
router.use('/api/v1/anonymous', anonymousRoutes);

export { router };
