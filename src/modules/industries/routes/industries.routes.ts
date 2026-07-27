import { Router } from 'express';
import { industriesController } from '../controller/industries.controller.js';
import { asyncHandler } from '../../../shared/utils/index.js';

const industriesRoutes = Router();

industriesRoutes.get('/', asyncHandler(industriesController.list.bind(industriesController)));

export { industriesRoutes };
