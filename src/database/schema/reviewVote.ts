import { pgTable, serial, uuid, integer, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { reviews } from './review.js';
import { anonymousIdentities } from './anonymousIdentity.js';

export const reviewVotes = pgTable(
  'review_votes',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id),
    anonymousId: uuid('anonymous_id')
      .notNull()
      .references(() => anonymousIdentities.id),
    voteType: text('vote_type', { enum: ['helpful', 'unhelpful'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    reviewAnonymousUnique: uniqueIndex('idx_review_vote_unique').on(
      table.reviewId,
      table.anonymousId,
    ),
    reviewIdx: index('idx_review_vote_review').on(table.reviewId),
  }),
);
