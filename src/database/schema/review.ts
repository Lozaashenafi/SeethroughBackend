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
import { anonymousIdentities } from './anonymousIdentity.js';
import { companies } from './company.js';

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    publicId: text('public_id').notNull().unique(),
    anonymousId: uuid('anonymous_id')
      .notNull()
      .references(() => anonymousIdentities.id),
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
    // One-way sha256 fingerprint of normalized title/pros/cons, used for
    // duplicate detection without storing raw copies.
    contentFingerprint: text('content_fingerprint'),
    // Moderation state: published reviews are visible publicly; pending reviews
    // wait in the admin moderation queue; rejected reviews are never shown.
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
    anonymousIdx: index('idx_review_anonymous').on(table.anonymousId),
    companyIdx: index('idx_review_company').on(table.companyId),
    createdAtIdx: index('idx_review_created_at').on(table.createdAt),
    ratingIdx: index('idx_review_rating').on(table.overallRating),
    // One review per identity per company, enforced at the database level so a
    // concurrent double-submit can never slip past the service check.
    anonymousCompanyUnique: uniqueIndex('idx_review_anonymous_company_unique').on(
      table.anonymousId,
      table.companyId,
    ),
  }),
);
