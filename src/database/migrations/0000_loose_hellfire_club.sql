CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "anonymous_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar(32) NOT NULL,
	"session_token_hash" varchar(255) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anonymous_identities_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "anonymous_identities_session_token_hash_unique" UNIQUE("session_token_hash")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"anonymous_id" uuid NOT NULL,
	"review_id" integer NOT NULL,
	"parent_id" integer,
	"content" text NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"industry_id" uuid NOT NULL,
	"website" varchar(255),
	"country" varchar(100),
	"city" varchar(100),
	"description" text,
	"logo_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(2, 1) DEFAULT '0',
	"recommendation_rate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	CONSTRAINT "industries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"anonymous_id" uuid NOT NULL,
	"review_id" integer,
	"comment_id" integer,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"anonymous_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pros" text,
	"cons" text,
	"overall_rating" integer,
	"work_life_balance" integer,
	"culture" integer,
	"management" integer,
	"compensation" integer,
	"opportunities" integer,
	"is_current_employee" boolean,
	"employment_status" text,
	"job_title" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"unhelpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "review_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"anonymous_id" uuid NOT NULL,
	"vote_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_anonymous_id_anonymous_identities_id_fk" FOREIGN KEY ("anonymous_id") REFERENCES "public"."anonymous_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_anonymous_id_anonymous_identities_id_fk" FOREIGN KEY ("anonymous_id") REFERENCES "public"."anonymous_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_anonymous_id_anonymous_identities_id_fk" FOREIGN KEY ("anonymous_id") REFERENCES "public"."anonymous_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_anonymous_id_anonymous_identities_id_fk" FOREIGN KEY ("anonymous_id") REFERENCES "public"."anonymous_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_anonymous_public_id" ON "anonymous_identities" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_anonymous_status" ON "anonymous_identities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_comment_public_id" ON "comments" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_comment_review" ON "comments" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_comment_anonymous" ON "comments" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "idx_comment_parent" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_company_slug" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_company_industry" ON "companies" USING btree ("industry_id");--> statement-breakpoint
CREATE INDEX "idx_company_name" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_report_public_id" ON "reports" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_report_anonymous" ON "reports" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "idx_report_review" ON "reports" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_report_comment" ON "reports" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_report_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_review_public_id" ON "reviews" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_review_anonymous" ON "reviews" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "idx_review_company" ON "reviews" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_review_created_at" ON "reviews" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_review_rating" ON "reviews" USING btree ("overall_rating");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_review_tag_unique" ON "review_tags" USING btree ("review_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_review_tag_review" ON "review_tags" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_review_vote_unique" ON "review_votes" USING btree ("review_id","anonymous_id");--> statement-breakpoint
CREATE INDEX "idx_review_vote_review" ON "review_votes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_tag_slug" ON "tags" USING btree ("slug");