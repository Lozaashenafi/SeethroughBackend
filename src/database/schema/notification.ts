import {
  pgTable,
  serial,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.js';

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type', { enum: ['comment', 'like'] }).notNull(),
    reviewPublicId: text('review_public_id').notNull(),
    message: text('message').notNull(),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index('idx_notification_user').on(table.userId),
    readIdx: index('idx_notification_read').on(table.read),
  }),
);
