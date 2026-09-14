import {
  pgTable,
  serial,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { companies } from './company.js';
import { users } from './user.js';

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    publicId: text('public_id').notNull().unique(),
    userId: uuid('user_id').notNull().references(() => users.id),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    title: text('title').notNull(),
    pros: text('pros'),
    cons: text('cons'),
    overallRating: integer('overall_rating'),
    workLifeBalance: integer('work_life_balance'),
    culture: integer('culture'),
    management: integer('management'),
    compensation: integer('compensation'),
    opportunities: integer('opportunities'),
    isCurrentEmployee: boolean('is_current_employee'),
    employmentStatus: text('employment_status', {
      enum: ['full-time', 'part-time', 'contract', 'intern', 'freelance'],
    }),
    jobTitle: text('job_title'),
    isVerified: boolean('is_verified').default(false).notNull(),
    contentFingerprint: text('content_fingerprint'),
    status: text('status', { enum: ['published', 'pending', 'rejected'] })
      .default('published')
      .notNull(),
    helpfulCount: integer('helpful_count').default(0).notNull(),
    unhelpfulCount: integer('unhelpful_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicIdIdx: index('idx_review_public_id').on(table.publicId),
    userIdx: index('idx_review_user').on(table.userId),
    companyIdx: index('idx_review_company').on(table.companyId),
    createdAtIdx: index('idx_review_created_at').on(table.createdAt),
    ratingIdx: index('idx_review_rating').on(table.overallRating),
    userCompanyUnique: uniqueIndex('idx_review_user_company_unique').on(
      table.userId,
      table.companyId,
    ),
  }),
);
