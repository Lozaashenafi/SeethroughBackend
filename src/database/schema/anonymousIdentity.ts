import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const anonymousIdentities = pgTable("anonymous_identities", {
  id: uuid("id").defaultRandom().primaryKey(),

  publicId: varchar("public_id", { length: 32 }).notNull().unique(),

  sessionTokenHash: varchar("session_token_hash", {
    length: 255,
  }).notNull().unique(),

  riskScore: integer("risk_score").default(0).notNull(),

  isBlocked: boolean("is_blocked").default(false).notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  lastSeenAt: timestamp("last_seen_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});