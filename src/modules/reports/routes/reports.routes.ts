import { Router } from 'express';
import { reportsController } from '../controller/reports.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { createReportSchema, listReportsQuerySchema, updateReportStatusSchema, reportPublicIdParamsSchema } from '../validation/reports.validation.js';

const reportsRoutes = Router();

// Reports require a logged-in, non-blocked user. Same dual budget pattern.
reportsRoutes.post(
  '/',
  userAuth({ required: true, enforceActive: true }),
  createRateLimiter(RATE_LIMITS.REPORT, { scope: 'user' }),
  createRateLimiter(RATE_LIMITS.REPORT_IP),
  validate({ body: createReportSchema }),
  asyncHandler(reportsController.create.bind(reportsController)),
);

// Admin-only routes
reportsRoutes.get(
  '/',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listReportsQuerySchema }),
  asyncHandler(reportsController.list.bind(reportsController)),
);

reportsRoutes.patch(
  '/:publicId/status',
  userAuth({ adminOnly: true }),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: reportPublicIdParamsSchema, body: updateReportStatusSchema }),
  asyncHandler(reportsController.updateStatus.bind(reportsController)),
);

export { reportsRoutes };
