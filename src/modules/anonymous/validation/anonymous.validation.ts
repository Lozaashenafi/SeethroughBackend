import { z } from 'zod';

// Letters (incl. Ethiopic), numbers, combining marks, spaces, and a small set
// of safe punctuation. Angle brackets are rejected outright — nicknames are
// rendered as plain text and never need markup.
const NICKNAME_CHARS_RE = /^[\p{L}\p{N}\p{M} ._'-]+$/u;

export const updateNicknameSchema = z.object({
  // Optional: when omitted the server picks an auto-generated nickname.
  nickname: z
    .string()
    .trim()
    .min(1, 'Nickname is required')
    .max(30, 'Nickname must be 30 characters or fewer')
    .regex(
      NICKNAME_CHARS_RE,
      "Nickname may only contain letters, numbers, spaces, and . _ ' -",
    )
    .optional(),
});

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
