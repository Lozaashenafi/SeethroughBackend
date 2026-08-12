import { z } from 'zod';
import { sanitizedString } from '../../../shared/utils/index.js';

export const createCommentSchema = z.object({
  reviewPublicId: z.string().min(1, 'Review publicId is required'),
  content: sanitizedString(1, 2000),
  // Public identifier of the parent comment. Internal DB ids are never exposed
  // through the API, so replies reference the parent via its publicId.
  parentPublicId: z.string().min(1, 'Parent comment publicId is required').optional(),
});

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
