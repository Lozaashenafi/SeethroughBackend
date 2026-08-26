import { Router } from 'express';
import { authController } from '../controller/auth.controller.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { loginSchema } from '../validation/auth.validation.js';

const authRoutes = Router();

// Rate limit login attempts: 10 per 15 minutes
authRoutes.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(authController.login.bind(authController)),
);

authRoutes.get(
  '/me',
  adminAuth(),
  asyncHandler(authController.me.bind(authController)),
);

authRoutes.post(
  '/logout',
  asyncHandler(authController.logout.bind(authController)),
);

export { authRoutes };
