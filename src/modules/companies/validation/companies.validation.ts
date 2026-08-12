import { z } from 'zod';
import { sanitizedString } from '../../../shared/utils/index.js';

export const companySlugParamsSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

export const listCompaniesQuerySchema = z.object({
  search: z.string().optional(),
  industry: z.string().uuid('Invalid industry ID').optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const checkDuplicateQuerySchema = z
  .object({
    website: z.string().trim().optional(),
    name: z.string().trim().optional(),
  })
  .refine((data) => data.website || data.name, {
    message: 'Provide a website or name to check for duplicates',
  });

export const createCompanySchema = z.object({
  name: sanitizedString(1, 255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  industryId: z.string().uuid('Invalid industry ID'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable(),
  country: sanitizedString(undefined, 100).optional(),
  city: sanitizedString(undefined, 100).optional(),
  description: sanitizedString(undefined, 5000).optional(),
});

export const updateCompanySchema = z.object({
  name: sanitizedString(1, 255).optional(),
  website: z.string().url('Invalid URL').optional().nullable(),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable(),
  country: sanitizedString(undefined, 100).optional().nullable(),
  city: sanitizedString(undefined, 100).optional().nullable(),
  description: sanitizedString(undefined, 5000).optional().nullable(),
  verified: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export const scrapeCompanySchema = z.object({
  website: z.string().min(1, 'Website URL is required'),
});
