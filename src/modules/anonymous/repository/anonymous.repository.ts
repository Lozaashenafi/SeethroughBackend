import { eq, and, count, desc, or, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { db, type DatabaseTx } from '../../../database/db.js';
import { anonymousIdentities } from '../../../database/schema/anonymousIdentity.js';
import { reviews } from '../../../database/schema/review.js';
import { comments } from '../../../database/schema/comment.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reviewTags } from '../../../database/schema/reviewTag.js';
import { reports } from '../../../database/schema/report.js';
import type { CreateAnonymousInput, CreateAnonymousResult } from '../types/anonymous.types.js';

import type { AnonymousIdentity } from '../../../shared/types/index.js';

type AnonymousRow = AnonymousIdentity & { sessionTokenHash: string };

type DbClient = typeof db | DatabaseTx;

export class AnonymousRepository {
  async create(input: CreateAnonymousInput): Promise<CreateAnonymousResult> {
    // 256-bit CSPRNG token — Math.random()/Date.now() are predictable and weak.
    const rawSessionToken = randomBytes(32).toString('base64url');

    const sessionTokenHash = createHash('sha256').update(rawSessionToken).digest('hex');

    const [identity] = await db
      .insert(anonymousIdentities)
      .values({
        publicId: input.publicId,
        sessionTokenHash,
        nickname: input.nickname,
      })
      .returning();

    return { identity, rawSessionToken };
  }

  async findByPublicId(publicId: string): Promise<AnonymousRow | null> {
    const [identity] = await db
      .select()
      .from(anonymousIdentities)
      .where(eq(anonymousIdentities.publicId, publicId));
    return identity ?? null;
  }

  async findById(id: string): Promise<AnonymousRow | null> {
    const [identity] = await db
      .select()
      .from(anonymousIdentities)
      .where(eq(anonymousIdentities.id, id));
    return identity ?? null;
  }

  /**
   * Case-insensitive exact lookup used to keep nicknames unique. `ilike` is
   * not used because `_` and `%` are valid nickname characters that would act
   * as LIKE wildcards; lower() equality is exact.
   */
  async findByNickname(nickname: string): Promise<AnonymousRow | null> {
    const [identity] = await db
      .select()
      .from(anonymousIdentities)
      .where(sql`lower(${anonymousIdentities.nickname}) = ${nickname.toLowerCase()}`);
    return identity ?? null;
  }

  async updateLastSeen(id: string): Promise<void> {
    await db
      .update(anonymousIdentities)
      .set({ lastSeenAt: new Date() })
      .where(eq(anonymousIdentities.id, id));
  }

  /**
   * Generate a fresh session token for an existing identity and store its hash.
   * Used when the browser presents a stale or mismatched session cookie —
   * instead of minting a brand-new identity (which floods the DB), we re-issue
   * a session for the same identity so the user keeps their data.
   */
  async reissueSessionToken(id: string): Promise<string> {
    const rawSessionToken = randomBytes(32).toString('base64url');
    const sessionTokenHash = createHash('sha256').update(rawSessionToken).digest('hex');

    await db
      .update(anonymousIdentities)
      .set({ sessionTokenHash })
      .where(eq(anonymousIdentities.id, id));

    return rawSessionToken;
  }

  async findAll(params: { page: number; limit: number; status?: string; search?: string }): Promise<{ data: AnonymousRow[]; total: number }> {
    const conditions: SQL[] = [];

    if (params.status && params.status !== 'all') {
      conditions.push(eq(anonymousIdentities.status, params.status as 'active' | 'disabled' | 'flagged'));
    }

    if (params.search) {
      const search = `%${params.search.trim()}%`;
      const searchCondition = or(
        ilike(anonymousIdentities.nickname, search),
        ilike(anonymousIdentities.publicId, search),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select()
      .from(anonymousIdentities)
      .where(whereClause)
      .orderBy(desc(anonymousIdentities.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(anonymousIdentities)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  async setBlocked(id: string, isBlocked: boolean): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({
        isBlocked,
        status: isBlocked ? 'disabled' : 'active',
      })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  async updateNickname(id: string, nickname: string): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ nickname, nicknameRegeneratedAt: new Date() })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  /**
   * Backfill a nickname WITHOUT marking it as regenerated. nicknameRegeneratedAt
   * is only set when the user explicitly exercises their one-time regeneration
   * (updateNickname), never for automated backfills — otherwise a legacy
   * identity would silently lose its regeneration right on first request.
   */
  async backfillNickname(id: string, nickname: string): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ nickname })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  async setTempBlocked(id: string, until: Date): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ tempBlockedUntil: until })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  async clearTempBlock(id: string): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ tempBlockedUntil: null })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  /**
   * Permanently remove every piece of content belonging to an identity, plus
   * any content that references it, so the identity row can later be deleted
   * without foreign-key violations:
   *
   * - the identity's reviews (and any comments / votes / tags / reports on them)
   * - the identity's comments, expanded recursively to include replies
   * - votes cast by the identity and reports filed by the identity
   *
   * Returns the company ids whose stats must be recomputed afterwards. Runs on
   * the provided client — the service wraps this in the outer transaction.
   */
  async deleteContentWithClient(client: DbClient, identityId: string): Promise<string[]> {
    // 1. The identity's own reviews and the companies they belong to.
    const ownReviews = await client
      .select({ id: reviews.id, companyId: reviews.companyId })
      .from(reviews)
      .where(eq(reviews.anonymousId, identityId));
    const ownReviewIds = ownReviews.map((r) => r.id);
    const companyIds = [...new Set(ownReviews.map((r) => r.companyId))];

    // 2. The identity's own comments, expanded recursively so replies to those
    //    comments (and replies to replies) are removed too — otherwise deleting
    //    a parent comment would leave its children with a dangling parentId.
    const commentIdsToDelete = new Set<number>();
    const ownComments = await client
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.anonymousId, identityId));
    for (const c of ownComments) commentIdsToDelete.add(c.id);

    let added = true;
    while (added && commentIdsToDelete.size > 0) {
      added = false;
      const children = await client
        .select({ id: comments.id })
        .from(comments)
        .where(inArray(comments.parentId, [...commentIdsToDelete]));
      for (const c of children) {
        if (!commentIdsToDelete.has(c.id)) {
          commentIdsToDelete.add(c.id);
          added = true;
        }
      }
    }

    // 3. Comments (by anyone) on the identity's reviews — they die with the reviews.
    if (ownReviewIds.length > 0) {
      const commentsOnReviews = await client
        .select({ id: comments.id })
        .from(comments)
        .where(inArray(comments.reviewId, ownReviewIds));
      for (const c of commentsOnReviews) commentIdsToDelete.add(c.id);
    }

    // 4. Reports referencing any of the above, or filed by the identity.
    const reportConditions: SQL[] = [eq(reports.anonymousId, identityId)];
    if (ownReviewIds.length > 0) {
      reportConditions.push(inArray(reports.reviewId, ownReviewIds));
    }
    if (commentIdsToDelete.size > 0) {
      reportConditions.push(inArray(reports.commentId, [...commentIdsToDelete]));
    }
    await client.delete(reports).where(or(...reportConditions));

    // 5. Comments (own + replies + comments on own reviews).
    if (commentIdsToDelete.size > 0) {
      await client.delete(comments).where(inArray(comments.id, [...commentIdsToDelete]));
    }

    // 6. Votes on the identity's reviews (any voter) or cast by the identity,
    //    review tags, and the reviews themselves.
    if (ownReviewIds.length > 0) {
      await client.delete(reviewVotes).where(
        or(inArray(reviewVotes.reviewId, ownReviewIds), eq(reviewVotes.anonymousId, identityId)),
      );
      await client.delete(reviewTags).where(inArray(reviewTags.reviewId, ownReviewIds));
      await client.delete(reviews).where(inArray(reviews.id, ownReviewIds));
    } else {
      // The identity voted/commented but never wrote a review of its own.
      await client.delete(reviewVotes).where(eq(reviewVotes.anonymousId, identityId));
    }

    return companyIds;
  }

  /** Delete the identity row itself. Call after deleteContentWithClient(). */
  async deleteWithClient(client: DbClient, identityId: string): Promise<void> {
    await client.delete(anonymousIdentities).where(eq(anonymousIdentities.id, identityId));
  }
}

export const anonymousRepository = new AnonymousRepository();
