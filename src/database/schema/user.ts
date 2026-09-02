import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    email: varchar('email', { length: 255 }).notNull().unique(),

    // Null when the user signed up via Google (no password).
    passwordHash: varchar('password_hash', { length: 255 }),

    displayName: varchar('display_name', { length: 100 }).notNull(),

    // Google OAuth subject ID. Null for email/password-only users.
    googleId: varchar('google_id', { length: 255 }).unique(),

    // Email verification
    emailVerified: boolean('email_verified').default(false).notNull(),
    verificationToken: varchar('verification_token', { length: 255 }),
    verificationExpiresAt: timestamp('verification_expires_at', {
      withTimezone: true,
    }),

    // Password reset
    resetToken: varchar('reset_token', { length: 255 }),
    resetExpiresAt: timestamp('reset_expires_at', {
      withTimezone: true,
    }),

    // When true, the user's display name is shown on their reviews instead
    // of "Anonymous". Default is false (anonymous).
    showDisplayName: boolean('show_display_name').default(false).notNull(),

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
