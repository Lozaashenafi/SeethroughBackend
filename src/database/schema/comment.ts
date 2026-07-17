import {
  pgTable,
  serial,
  uuid,
  text,
  timestamp,
  integer,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { anonymousIdentities } from './anonymousIdentity.js';
import { reviews } from './review.js';

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    publicId: text('public_id').notNull().unique(),
    anonymousId: uuid('anonymous_id')
      .notNull()
      .references(() => anonymousIdentities.id),
    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id),
    parentId: integer('parent_id').references((): AnyPgColumn => comments.id),
    content: text('content').notNull(),
    helpfulCount: integer('helpful_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicIdIdx: index('idx_comment_public_id').on(table.publicId),
    reviewIdx: index('idx_comment_review').on(table.reviewId),
    anonymousIdx: index('idx_comment_anonymous').on(table.anonymousId),
    parentIdx: index('idx_comment_parent').on(table.parentId),
  }),
);
