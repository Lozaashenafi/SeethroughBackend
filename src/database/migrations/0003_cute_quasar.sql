CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"review_public_id" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "show_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "reviewer_name" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_read" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_report_user_review" ON "reports" USING btree ("user_id","review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_report_user_comment" ON "reports" USING btree ("user_id","comment_id");