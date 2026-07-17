import { pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';

export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('idx_tag_slug').on(table.slug),
  }),
);
