import { z } from 'zod';

export const listIdentitiesQuerySchema = z.object({
  status: z.enum(['active', 'disabled', 'flagged', 'all']).optional().default('all'),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const tempBlockSchema = z.object({
  hours: z.coerce.number().int().positive().max(720).optional(),
});
