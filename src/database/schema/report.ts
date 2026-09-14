import {
  pgTable,
  serial,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { reviews } from './review.js';
import { comments } from './comment.js';
import { users } from './user.js';

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    publicId: text('public_id').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
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
    userIdx: index('idx_report_user').on(table.userId),
    reviewIdx: index('idx_report_review').on(table.reviewId),
    commentIdx: index('idx_report_comment').on(table.commentId),
    statusIdx: index('idx_report_status').on(table.status),
  }),
);
