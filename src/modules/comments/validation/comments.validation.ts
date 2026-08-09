import { z } from 'zod';
import { sanitizedString } from '../../../shared/utils/index.js';

export const createCommentSchema = z.object({
  reviewPublicId: z.string().min(1, 'Review publicId is required'),
  content: sanitizedString(1, 2000),
  parentId: z.number().int().positive('Invalid parent comment ID').optional(),
});

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
