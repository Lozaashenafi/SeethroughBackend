import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { industries } from "./industry.js";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", { length: 255 }).notNull(),

    slug: varchar("slug", {
      length: 255,
    })
      .notNull()
      .unique(),

    industryId: uuid("industry_id")
      .references(() => industries.id)
      .notNull(),

    website: varchar("website", {
      length: 255,
    }),

    country: varchar("country", {
      length: 100,
    }),

    city: varchar("city", {
      length: 100,
    }),

    description: text("description"),

    logoUrl: text("logo_url"),

    verified: boolean("verified")
      .default(false)
      .notNull(),

    reviewCount: integer("review_count")
      .default(0)
      .notNull(),

    averageRating: decimal("average_rating", {
      precision: 2,
      scale: 1,
    }).default("0"),

    recommendationRate: integer("recommendation_rate")
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIdx: index("idx_company_slug").on(table.slug),
    industryIdx: index("idx_company_industry").on(table.industryId),
    nameIdx: index("idx_company_name").on(table.name),
  }),
);
