import { Router } from 'express';
import { reportsController } from '../controller/reports.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createReportSchema, listReportsQuerySchema, updateReportStatusSchema, reportPublicIdParamsSchema } from '../validation/reports.validation.js';

const reportsRoutes = Router();

// Public - Anyone can submit a report
reportsRoutes.post(
  '/',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.REPORT),
  validate({ body: createReportSchema }),
  asyncHandler(reportsController.create.bind(reportsController)),
);

// Admin-only routes
reportsRoutes.get(
  '/',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listReportsQuerySchema }),
  asyncHandler(reportsController.list.bind(reportsController)),
);

reportsRoutes.patch(
  '/:publicId/status',
  adminAuth(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reportPublicIdParamsSchema, body: updateReportStatusSchema }),
  asyncHandler(reportsController.updateStatus.bind(reportsController)),
);

export { reportsRoutes };
