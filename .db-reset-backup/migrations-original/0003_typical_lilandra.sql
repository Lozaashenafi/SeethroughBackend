-- Enforce one review per identity per company at the database level.
--
-- The unique index below can only be created once existing duplicates are
-- gone, so this migration first removes them. Per (anonymous_id, company_id)
-- group we keep a single review and delete the rest — preferring published
-- content over pending/rejected, then the newest. Children of the removed
-- reviews (comments, votes, tags, reports referencing them) are deleted in
-- dependency order because the foreign keys are not cascading.
--
-- drizzle's migrator wraps this entire file in one transaction, so a failure
-- anywhere rolls back both the dedupe and the index creation.

-- Materialize the reviews to remove: every review except the keeper in each
-- duplicate group. Published is preferred, then pending, then rejected; ties
-- broken by newest (created_at, then id).
CREATE TEMP TABLE IF NOT EXISTS _review_dedupe_doomed AS
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY anonymous_id, company_id
      ORDER BY
        CASE status WHEN 'published' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        created_at DESC,
        id DESC
    ) AS rn
  FROM reviews
)
SELECT id FROM ranked WHERE rn > 1;

-- Reports may reference the doomed reviews directly or comments on them.
DELETE FROM reports
WHERE review_id IN (SELECT id FROM _review_dedupe_doomed)
   OR comment_id IN (
        SELECT id FROM comments
        WHERE review_id IN (SELECT id FROM _review_dedupe_doomed)
      );

-- Comments on doomed reviews (replies share the same review_id, so they all
-- go together — no dangling parent_id can remain).
DELETE FROM comments
WHERE review_id IN (SELECT id FROM _review_dedupe_doomed);

DELETE FROM review_votes WHERE review_id IN (SELECT id FROM _review_dedupe_doomed);
DELETE FROM review_tags WHERE review_id IN (SELECT id FROM _review_dedupe_doomed);

-- The duplicates themselves.
DELETE FROM reviews WHERE id IN (SELECT id FROM _review_dedupe_doomed);

DROP TABLE IF EXISTS _review_dedupe_doomed;

-- From here on the database itself rejects a second review of the same
-- company by the same identity (service-level check remains as defense in
-- depth and to give a friendly 409 instead of a raw constraint error).
CREATE UNIQUE INDEX IF NOT EXISTS "idx_review_anonymous_company_unique" ON "reviews" USING btree ("anonymous_id","company_id");
