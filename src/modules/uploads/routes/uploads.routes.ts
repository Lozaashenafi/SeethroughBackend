import { Router } from 'express';
import multer from 'multer';
import { uploadsController } from '../controller/uploads.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { temporarilyBlockedGuard } from '../../../middlewares/temporarilyBlockedGuard.middleware.js';
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

// Any visitor can upload a logo (it gets attached when they create a company),
// but spam-blocked identities and abusers are throttled hard.
uploadsRoutes.post(
  '/logo',
  anonymousIdentity(),
  temporarilyBlockedGuard(),
  createRateLimiter(RATE_LIMITS.UPLOAD),
  upload.single('file'),
  asyncHandler(uploadsController.uploadLogo.bind(uploadsController)),
);

export { uploadsRoutes };
