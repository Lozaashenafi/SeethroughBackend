import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    googleId: varchar('google_id', { length: 255 }).unique(),
    role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    verificationToken: varchar('verification_token', { length: 255 }),
    verificationExpiresAt: timestamp('verification_expires_at', {
      withTimezone: true,
    }),
    resetToken: varchar('reset_token', { length: 255 }),
    resetExpiresAt: timestamp('reset_expires_at', {
      withTimezone: true,
    }),
    // Moderation state, managed from the admin Users tab. A blocked user can
    // still browse (and log in) but cannot post reviews, comments, votes or
    // reports; `tempBlockedUntil` is the softer, self-expiring variant.
    isBlocked: boolean('is_blocked').default(false).notNull(),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    tempBlockedUntil: timestamp('temp_blocked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: index('idx_user_email').on(table.email),
    googleIdIdx: index('idx_user_google_id').on(table.googleId),
    verificationTokenIdx: index('idx_user_verification_token').on(
      table.verificationToken,
    ),
  }),
);
