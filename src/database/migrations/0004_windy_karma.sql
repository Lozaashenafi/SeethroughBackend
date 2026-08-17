-- Make anonymous nicknames unique platform-wide (case-insensitively, so
-- "Quiet Fox" and "quiet fox" can never both exist).
--
-- The unique index below can only be created once existing duplicates are
-- gone, so this migration first de-duplicates them. For every normalized
-- (lowercased) nickname we keep the FIRST identity that claimed it and append
-- a short random suffix to the rest, so no identity loses its display name
-- entirely. NULL nicknames are untouched (Postgres unique indexes allow
-- multiple NULLs).
--
-- drizzle's migrator wraps this entire file in one transaction, so a failure
-- anywhere rolls back both the dedupe and the index creation.

-- Suffix every duplicate nickname (all rows after the first per lowercased
-- nickname) with 4 random hex characters. The DISTINCT ON keeps the oldest
-- identity per nickname.
UPDATE anonymous_identities AS target
SET nickname = target.nickname || ' ' || substr(md5(random()::text), 1, 4)
WHERE target.nickname IS NOT NULL
  AND target.id NOT IN (
    SELECT DISTINCT ON (lower(nickname)) id
    FROM anonymous_identities
    WHERE nickname IS NOT NULL
    ORDER BY lower(nickname), created_at, id
  );

-- From here on the database itself rejects a duplicate nickname (the service
-- keeps generating unique ones and gives a friendly 409 for taken custom
-- names).
CREATE UNIQUE INDEX "idx_anonymous_nickname_unique" ON "anonymous_identities" USING btree (lower("nickname"));
