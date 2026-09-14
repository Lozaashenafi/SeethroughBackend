import { Router } from 'express';
import multer from 'multer';
import { uploadsController } from '../controller/uploads.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { MAX_LOGO_SIZE_BYTES } from '../service/uploads.service.js';

// Memory storage: the file lives in a Buffer just long enough to stream it to
// Vercel Blob. No temp files (serverless filesystem is read-only anyway).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_LOGO_SIZE_BYTES,
    files: 1,
  },
});

const uploadsRoutes = Router();

// Authenticated users can upload a logo
uploadsRoutes.post(
  '/logo',
  userAuth({ required: true }),
  createRateLimiter(RATE_LIMITS.UPLOAD),
  upload.single('file'),
  asyncHandler(uploadsController.uploadLogo.bind(uploadsController)),
);

export { uploadsRoutes };
