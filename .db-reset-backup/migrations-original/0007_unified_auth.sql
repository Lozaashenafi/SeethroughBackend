DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_anonymous_id_anonymous_identities_id_fk";
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "anonymous_id";

UPDATE "reviews" SET "user_id" = (SELECT "id" FROM "users" LIMIT 1) WHERE "user_id" IS NULL;

DO $$ BEGIN
  ALTER TABLE "reviews" ALTER COLUMN "user_id" SET NOT NULL;
EXCEPTION WHEN not_null_violation THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_review_user_company_unique" ON "reviews" USING btree ("user_id","company_id");

DROP INDEX IF EXISTS "idx_review_anonymous_company_unique";
DROP INDEX IF EXISTS "idx_review_anonymous";

DROP TABLE IF EXISTS "admins" CASCADE;
