-- Create notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "type" text NOT NULL,
  "review_public_id" text NOT NULL,
  "message" text NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_notification_user" ON "notifications" ("user_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_notification_read" ON "notifications" ("read");
