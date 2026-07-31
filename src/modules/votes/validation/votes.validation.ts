import { z } from 'zod';

export const createVoteSchema = z.object({
  reviewPublicId: z.string().min(1, 'Review publicId is required'),
  voteType: z.enum(['helpful', 'unhelpful'], {
    errorMap: () => ({ message: 'Vote type must be "helpful" or "unhelpful"' }),
  }),
});
