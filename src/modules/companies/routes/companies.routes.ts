import { Router } from 'express';
import { companiesController } from '../controller/companies.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import {
  listCompaniesQuerySchema,
  companySlugParamsSchema,
  createCompanySchema,
  updateCompanySchema,
} from '../validation/companies.validation.js';

const companiesRoutes = Router();

// Public routes
companiesRoutes.get(
  '/',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listCompaniesQuerySchema }),
  asyncHandler(companiesController.list.bind(companiesController)),
);

companiesRoutes.get(
  '/:slug',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: companySlugParamsSchema }),
  asyncHandler(companiesController.getBySlug.bind(companiesController)),
);

// Public — anyone can create a company
companiesRoutes.post(
  '/',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.REVIEW_CREATE),
  validate({ body: createCompanySchema }),
  asyncHandler(companiesController.create.bind(companiesController)),
);

// Admin-only routes
companiesRoutes.put(
  '/:slug',
  adminAuth(),
  validate({ params: companySlugParamsSchema, body: updateCompanySchema }),
  asyncHandler(companiesController.update.bind(companiesController)),
);

companiesRoutes.delete(
  '/:slug',
  adminAuth(),
  validate({ params: companySlugParamsSchema }),
  asyncHandler(companiesController.delete.bind(companiesController)),
);

export { companiesRoutes };
