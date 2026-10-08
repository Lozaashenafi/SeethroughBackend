import { z } from 'zod';
import { sanitizedString } from '../../../shared/utils/index.js';

export const createReviewSchema = z.object({
  companySlug: z.string().min(1, 'Company slug is required'),
  title: sanitizedString(10, 200),
  pros: sanitizedString(undefined, 2000).optional(),
  cons: sanitizedString(undefined, 2000).optional(),
  overallRating: z.number().int().min(1).max(5).optional(),
  workLifeBalance: z.number().int().min(1).max(5).optional(),
  culture: z.number().int().min(1).max(5).optional(),
  management: z.number().int().min(1).max(5).optional(),
  compensation: z.number().int().min(1).max(5).optional(),
  opportunities: z.number().int().min(1).max(5).optional(),
  isCurrentEmployee: z.boolean().optional(),
  employmentStatus: z.enum(['full-time', 'part-time', 'contract', 'intern', 'freelance']).optional(),
  tenure: z.enum(['under-1-year', '1-2-years', '3-5-years', '6-10-years', '10-plus-years']).optional(),
  jobTitle: sanitizedString(undefined, 100).optional(),
  tagIds: z.array(z.number().int().positive()).max(10).optional(),
});

export const reviewPublicIdParamsSchema = z.object({
  publicId: z.string().min(1, 'Review publicId is required'),
});

// AI title suggestion — only the raw material for the summary is accepted.
export const suggestTitleSchema = z.object({
  pros: sanitizedString(undefined, 2000).optional(),
  cons: sanitizedString(undefined, 2000).optional(),
  jobTitle: sanitizedString(undefined, 100).optional(),
  // `auto` = drafted by the form while typing, `manual` = explicit button click.
  trigger: z.enum(['auto', 'manual']).optional(),
});

// The author may edit everything except the company the review is attached to.
// All fields are optional — omitted fields keep their current value.
export const updateReviewSchema = z.object({
  title: sanitizedString(10, 200).optional(),
  pros: sanitizedString(undefined, 2000).optional(),
  cons: sanitizedString(undefined, 2000).optional(),
  overallRating: z.number().int().min(1).max(5).optional(),
  workLifeBalance: z.number().int().min(1).max(5).optional(),
  culture: z.number().int().min(1).max(5).optional(),
  management: z.number().int().min(1).max(5).optional(),
  compensation: z.number().int().min(1).max(5).optional(),
  opportunities: z.number().int().min(1).max(5).optional(),
  isCurrentEmployee: z.boolean().optional(),
  employmentStatus: z
    .enum(['full-time', 'part-time', 'contract', 'intern', 'freelance'])
    .optional(),
  tenure: z.enum(['under-1-year', '1-2-years', '3-5-years', '6-10-years', '10-plus-years']).optional(),
  jobTitle: sanitizedString(undefined, 100).optional(),
  tagIds: z.array(z.number().int().positive()).max(10).optional(),
});

export const listReviewsQuerySchema = z.object({
  companySlug: z.string().optional(),
  sortBy: z.enum(['recent', 'engagement']).optional(),
  status: z.enum(['published', 'pending', 'rejected', 'all']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const moderateReviewSchema = z.object({
  status: z.enum(['published', 'rejected']),
});

// Blind ban (and its inverse, blind unban) take no body — the author is
// resolved server-side from the review's publicId and their identity is never
// returned in either direction.
export const banAuthorSchema = z.object({}).strict();
