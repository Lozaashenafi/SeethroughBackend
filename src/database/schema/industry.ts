import {
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const industries = pgTable("industries", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", {
    length: 100,
  }).notNull(),

  slug: varchar("slug", {
    length: 120,
  })
    .notNull()
    .unique(),
});