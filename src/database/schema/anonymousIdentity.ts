import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const anonymousIdentities = pgTable(
  "anonymous_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    publicId: varchar("public_id", { length: 32 }).notNull().unique(),

    sessionTokenHash: varchar("session_token_hash", {
      length: 255,
    }).notNull().unique(),

    // Public pseudonym (adjective + animal) shown next to reviews. The internal
    // UUID/publicId is never exposed to other users.
    nickname: varchar("nickname", { length: 60 }),

    // Set once a nickname has been regenerated — allows exactly one regeneration.
    nicknameRegeneratedAt: timestamp("nickname_regenerated_at", {
      withTimezone: true,
    }),

    // When set in the future, the identity is temporarily blocked from
    // submitting content (spam/abuse). Read-only browsing still works.
    tempBlockedUntil: timestamp("temp_blocked_until", {
      withTimezone: true,
    }),

    status: text("status", { enum: ["active", "disabled", "flagged"] })
      .default("active")
      .notNull(),

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
  },
  (table) => ({
    publicIdIdx: index("idx_anonymous_public_id").on(table.publicId),
    statusIdx: index("idx_anonymous_status").on(table.status),
  }),
);