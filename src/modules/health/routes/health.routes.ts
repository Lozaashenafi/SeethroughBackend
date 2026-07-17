import { Router } from 'express';
import { healthController } from '../controller/health.controller.js';
import { asyncHandler } from '../../../shared/utils/index.js';

const healthRoutes = Router();

healthRoutes.get('/', asyncHandler(healthController.check.bind(healthController)));

export { healthRoutes };
