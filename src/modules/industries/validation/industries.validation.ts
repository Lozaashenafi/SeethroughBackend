import { z } from 'zod';

export const industryParamsSchema = z.object({
  id: z.string().uuid('Invalid industry ID'),
});
