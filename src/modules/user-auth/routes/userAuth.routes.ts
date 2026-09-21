import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { userAuthController } from '../controller/userAuth.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import {
  registerSchema,
  loginSchema,
  googleCallbackSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateDisplayNameSchema,
  changePasswordSchema,
  setPasswordSchema,
} from '../validation/userAuth.validation.js';

const userAuthRoutes = Router();

// Strict rate limit on registration: 5 attempts per 15 minutes
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit on login: 10 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit on password reset: 3 attempts per 15 minutes
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Too many reset attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
userAuthRoutes.post(
  '/register',
  registerLimiter,
  validate({ body: registerSchema }),
  asyncHandler(userAuthController.register.bind(userAuthController)),
);

userAuthRoutes.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(userAuthController.login.bind(userAuthController)),
);

userAuthRoutes.post(
  '/google',
  validate({ body: googleCallbackSchema }),
  asyncHandler(userAuthController.googleCallback.bind(userAuthController)),
);

userAuthRoutes.post(
  '/verify-email',
  validate({ body: verifyEmailSchema }),
  asyncHandler(userAuthController.verifyEmail.bind(userAuthController)),
);

userAuthRoutes.post(
  '/forgot-password',
  resetLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(userAuthController.forgotPassword.bind(userAuthController)),
);

userAuthRoutes.post(
  '/reset-password',
  resetLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(userAuthController.resetPassword.bind(userAuthController)),
);

userAuthRoutes.post(
  '/resend-verification',
  registerLimiter,
  userAuth({ required: true }),
  asyncHandler(userAuthController.resendVerification.bind(userAuthController)),
);

userAuthRoutes.patch(
  '/display-name',
  userAuth({ required: true }),
  validate({ body: updateDisplayNameSchema }),
  asyncHandler(userAuthController.updateDisplayName.bind(userAuthController)),
);

userAuthRoutes.patch(
  '/change-password',
  userAuth({ required: true }),
  validate({ body: changePasswordSchema }),
  asyncHandler(userAuthController.changePassword.bind(userAuthController)),
);

userAuthRoutes.patch(
  '/set-password',
  userAuth({ required: true }),
  validate({ body: setPasswordSchema }),
  asyncHandler(userAuthController.setPassword.bind(userAuthController)),
);

// Protected routes
userAuthRoutes.get(
  '/me',
  userAuth({ required: true }),
  asyncHandler(userAuthController.me.bind(userAuthController)),
);

userAuthRoutes.get(
  '/me/reviews',
  userAuth({ required: true }),
  asyncHandler(userAuthController.getMyReviews.bind(userAuthController)),
);

userAuthRoutes.get(
  '/me/reviews/:publicId',
  userAuth({ required: true }),
  asyncHandler(userAuthController.getMyReview.bind(userAuthController)),
);

userAuthRoutes.post(
  '/logout',
  userAuth({ required: true }),
  asyncHandler(userAuthController.logout.bind(userAuthController)),
);

export { userAuthRoutes };
