import { Router } from 'express';
import { tagsController } from '../controller/tags.controller.js';
import { asyncHandler } from '../../../shared/utils/index.js';

const tagsRoutes = Router();

tagsRoutes.get('/', asyncHandler(tagsController.list.bind(tagsController)));

export { tagsRoutes };
