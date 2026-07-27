import { z } from 'zod';

export const tagParamsSchema = z.object({
  id: z.coerce.number().int().positive('Invalid tag ID'),
});
