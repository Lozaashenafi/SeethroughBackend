import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controller/auth.controller.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { loginSchema } from '../validation/auth.validation.js';

const authRoutes = Router();

// Strict IP-based rate limit on login: 10 attempts per 15 minutes.
// Uses req.ip (respects trust proxy) since the user is not yet authenticated.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

authRoutes.post(
  '/login',
  loginLimiter,
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
