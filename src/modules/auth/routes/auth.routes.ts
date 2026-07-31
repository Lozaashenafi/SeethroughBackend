import { Router } from 'express';
import { authController } from '../controller/auth.controller.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { loginSchema } from '../validation/auth.validation.js';

const authRoutes = Router();

// Rate limit login attempts: 10 per 15 minutes
authRoutes.post(
  '/login',
  createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again later.' }),
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
  createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many requests. Please try again later.' }),
  asyncHandler(authController.logout.bind(authController)),
);

export { authRoutes };
