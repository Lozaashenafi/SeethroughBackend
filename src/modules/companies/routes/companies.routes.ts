import { Router } from 'express';
import multer from 'multer';
import { companiesController } from '../controller/companies.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import { MAX_LOGO_SIZE_BYTES } from '../../uploads/service/uploads.service.js';
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
companiesRoutes.get(
  '/',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listCompaniesQuerySchema }),
  asyncHandler(companiesController.list.bind(companiesController)),
);

// Scrape — must come BEFORE /:slug to prevent Express from matching 'scrape' as a slug
companiesRoutes.post(
  '/scrape',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ body: scrapeCompanySchema }),
  asyncHandler(companiesController.scrape.bind(companiesController)),
);

// Duplicate check — must also come BEFORE /:slug
companiesRoutes.get(
  '/check',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: checkDuplicateQuerySchema }),
  asyncHandler(companiesController.checkDuplicates.bind(companiesController)),
);

companiesRoutes.get(
  '/:slug',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: companySlugParamsSchema }),
  asyncHandler(companiesController.getBySlug.bind(companiesController)),
);

// Anyone can create a company, but authenticated users only
companiesRoutes.post(
  '/',
  userAuth({ required: true }),
  createRateLimiter(RATE_LIMITS.COMPANY_CREATE),
  validate({ body: createCompanySchema }),
  asyncHandler(companiesController.create.bind(companiesController)),
);

// Admin-only routes
companiesRoutes.put(
  '/:slug',
  userAuth({ adminOnly: true }),
  validate({ params: companySlugParamsSchema, body: updateCompanySchema }),
  asyncHandler(companiesController.update.bind(companiesController)),
);

companiesRoutes.delete(
  '/:slug',
  userAuth({ adminOnly: true }),
  validate({ params: companySlugParamsSchema }),
  asyncHandler(companiesController.delete.bind(companiesController)),
);

// Admin-only: upload a logo file and attach it to the company in one call.
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_SIZE_BYTES, files: 1 },
});

companiesRoutes.put(
  '/:slug/logo',
  userAuth({ adminOnly: true }),
  validate({ params: companySlugParamsSchema }),
  logoUpload.single('file'),
  asyncHandler(companiesController.uploadLogo.bind(companiesController)),
);

export { companiesRoutes };
