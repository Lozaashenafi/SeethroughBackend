import { z } from 'zod';
import { sanitizedString } from '../../../shared/utils/index.js';

export const createReportSchema = z.object({
  reviewPublicId: z.string().optional(),
  commentPublicId: z.string().optional(),
  reason: sanitizedString(1, 500),
  description: sanitizedString(undefined, 2000).optional(),
}).refine(
  (data) => data.reviewPublicId || data.commentPublicId,
  { message: 'Either reviewPublicId or commentPublicId must be provided' },
);

export const listReportsQuerySchema = z.object({
  status: z.enum(['pending', 'resolved', 'dismissed', 'all']).optional().default('pending'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateReportStatusSchema = z.object({
  status: z.enum(['resolved', 'dismissed'], {
    errorMap: () => ({ message: 'Status must be "resolved" or "dismissed"' }),
  }),
});

export const reportPublicIdParamsSchema = z.object({
  publicId: z.string().min(1, 'Report publicId is required'),
});
