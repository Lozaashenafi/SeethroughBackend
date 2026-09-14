import { pgTable, serial, uuid, integer, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { reviews } from './review.js';
import { users } from './user.js';

export const reviewVotes = pgTable(
  'review_votes',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    voteType: text('vote_type', { enum: ['helpful', 'unhelpful'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    reviewUserUnique: uniqueIndex('idx_review_vote_unique').on(
      table.reviewId,
      table.userId,
    ),
    reviewIdx: index('idx_review_vote_review').on(table.reviewId),
  }),
);
