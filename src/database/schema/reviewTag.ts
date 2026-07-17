import { pgTable, serial, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { reviews } from './review.js';
import { tags } from './tag.js';

export const reviewTags = pgTable(
  'review_tags',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id),
  },
  (table) => ({
    reviewTagUnique: uniqueIndex('idx_review_tag_unique').on(table.reviewId, table.tagId),
    reviewIdx: uniqueIndex('idx_review_tag_review').on(table.reviewId),
  }),
);
