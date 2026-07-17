import { z } from 'zod';

export const anonymousParamsSchema = z.object({
  publicId: z.string().min(1, 'publicId is required'),
});
