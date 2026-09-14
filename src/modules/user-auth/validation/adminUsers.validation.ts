import { z } from 'zod';

export const listAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional(),
  role: z.enum(['user', 'admin', 'all']).optional().default('all'),
  status: z.enum(['active', 'blocked', 'restricted', 'all']).optional().default('all'),
});

export const adminUserParamsSchema = z.object({
  userId: z.string().uuid('A valid user id is required'),
});

export const adminUserActivityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** `hours` is clamped to a year so a typo can't restrict someone indefinitely. */
export const tempBlockUserSchema = z.object({
  hours: z.coerce.number().int().positive().max(24 * 365).default(24),
});
