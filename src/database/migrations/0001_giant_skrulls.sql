ALTER TABLE "anonymous_identities" ADD COLUMN "nickname" varchar(60);--> statement-breakpoint
ALTER TABLE "anonymous_identities" ADD COLUMN "nickname_regenerated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anonymous_identities" ADD COLUMN "temp_blocked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;