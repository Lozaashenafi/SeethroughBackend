import { z } from 'zod';

export const listIdentitiesQuerySchema = z.object({
  status: z.enum(['active', 'disabled', 'flagged', 'all']).optional().default('all'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
