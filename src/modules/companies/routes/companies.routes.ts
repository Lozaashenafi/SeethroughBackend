import { Router } from 'express';
import { companiesController } from '../controller/companies.controller.js';
import { anonymousIdentity } from '../../../middlewares/anonymousIdentity.middleware.js';
import { adminAuth } from '../../../middlewares/adminAuth.middleware.js';
import { temporarilyBlockedGuard } from '../../../middlewares/temporarilyBlockedGuard.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import {
  listCompaniesQuerySchema,
  companySlugParamsSchema,
  createCompanySchema,
  updateCompanySchema,
  scrapeCompanySchema,
  checkDuplicateQuerySchema,
} from '../validation/companies.validation.js';

const companiesRoutes = Router();

// Public routes
// anonymousIdentity() runs before the rate limiter so limits are keyed per
// identity (not per IP), consistent with the rest of the API.
companiesRoutes.get(
  '/',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listCompaniesQuerySchema }),
  asyncHandler(companiesController.list.bind(companiesController)),
);

// Scrape — must come BEFORE /:slug to prevent Express from matching 'scrape' as a slug
companiesRoutes.post(
  '/scrape',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ body: scrapeCompanySchema }),
  asyncHandler(companiesController.scrape.bind(companiesController)),
);

// Duplicate check — must also come BEFORE /:slug
companiesRoutes.get(
  '/check',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: checkDuplicateQuerySchema }),
  asyncHandler(companiesController.checkDuplicates.bind(companiesController)),
);

companiesRoutes.get(
  '/:slug',
  anonymousIdentity(),
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: companySlugParamsSchema }),
  asyncHandler(companiesController.getBySlug.bind(companiesController)),
);

// Public — anyone can create a company, but identities under a temporary
// spam/abuse restriction are blocked (consistent with all other content
// submission endpoints).
companiesRoutes.post(
  '/',
  anonymousIdentity(),
  temporarilyBlockedGuard(),
  createRateLimiter(RATE_LIMITS.COMPANY_CREATE),
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
