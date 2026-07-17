import {
  pgTable,
  serial,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { anonymousIdentities } from './anonymousIdentity.js';
import { reviews } from './review.js';
import { comments } from './comment.js';

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    publicId: text('public_id').notNull().unique(),
    anonymousId: uuid('anonymous_id')
      .notNull()
      .references(() => anonymousIdentities.id),
    reviewId: integer('review_id').references(() => reviews.id),
    commentId: integer('comment_id').references(() => comments.id),
    reason: text('reason').notNull(),
    description: text('description'),
    status: text('status', { enum: ['pending', 'resolved', 'dismissed'] })
      .default('pending')
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    publicIdIdx: index('idx_report_public_id').on(table.publicId),
    anonymousIdx: index('idx_report_anonymous').on(table.anonymousId),
    reviewIdx: index('idx_report_review').on(table.reviewId),
    statusIdx: index('idx_report_status').on(table.status),
  }),
);
