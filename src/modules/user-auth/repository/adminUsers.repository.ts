import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { db, type DatabaseTx } from '../../../database/db.js';
import { users } from '../../../database/schema/user.js';
import { reviews } from '../../../database/schema/review.js';
import { comments } from '../../../database/schema/comment.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reviewTags } from '../../../database/schema/reviewTag.js';
import { reports } from '../../../database/schema/report.js';

type DbClient = typeof db | DatabaseTx;

/** Columns safe to expose to the admin UI (never tokens or password hashes). */
const adminUserColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  emailVerified: users.emailVerified,
  isBlocked: users.isBlocked,
  blockedAt: users.blockedAt,
  tempBlockedUntil: users.tempBlockedUntil,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  isBlocked: boolean;
  blockedAt: Date | null;
  tempBlockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ListAdminUsersParams {
  page: number;
  limit: number;
  search?: string;
  role: 'user' | 'admin' | 'all';
  status: 'active' | 'blocked' | 'restricted' | 'all';
}

export class AdminUsersRepository {
  async findAll(
    params: ListAdminUsersParams,
  ): Promise<{ data: AdminUserRow[]; total: number }> {
    const conditions: SQL[] = [];
    const now = new Date();

    if (params.role !== 'all') {
      conditions.push(eq(users.role, params.role));
    }

    // `active` means "can post right now": not blocked and not currently
    // inside a temp-block window that has already expired.
    if (params.status === 'blocked') {
      conditions.push(eq(users.isBlocked, true));
    } else if (params.status === 'restricted') {
      conditions.push(
        and(eq(users.isBlocked, false), gt(users.tempBlockedUntil, now))!,
      );
    } else if (params.status === 'active') {
      conditions.push(
        and(
          eq(users.isBlocked, false),
          or(isNull(users.tempBlockedUntil), lte(users.tempBlockedUntil, now))!,
        )!,
      );
    }

    if (params.search) {
      const search = `%${params.search.trim()}%`;
      const searchCondition = or(
        ilike(users.email, search),
        ilike(users.displayName, search),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select(adminUserColumns)
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(users)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  async findById(id: string): Promise<AdminUserRow | null> {
    const [user] = await db
      .select(adminUserColumns)
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  }

  /**
   * Block or unblock an account. Unblocking also clears any temp-block window,
   * so "unblock" always leaves the user fully able to post again.
   */
  /**
   * Blind ban: resolve the author of a review and block them without ever
   * returning any identity. The caller only learns whether a ban was applied.
   * Admins can already list every account (with emails) in the admin UI, so
   * the server learning the id is not a new exposure — but this endpoint
   * deliberately never echoes it back, and there is no route that maps a
   * review to its author.
   */
  async blockAuthorOfReview(reviewPublicId: string): Promise<{ banned: boolean }> {
    const [review] = await db
      .select({ userId: reviews.userId })
      .from(reviews)
      .where(eq(reviews.publicId, reviewPublicId))
      .limit(1);
    if (!review) return { banned: false };

    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, review.userId))
      .limit(1);
    // Never ban an admin account — banning a co-admin from the review UI
    // would lock the whole admin panel.
    if (!user || user.role === 'admin') return { banned: false };

    await this.setBlocked(user.id, true);
    return { banned: true };
  }

  async setBlocked(id: string, blocked: boolean): Promise<AdminUserRow | null> {
    const [user] = await db
      .update(users)
      .set({
        isBlocked: blocked,
        blockedAt: blocked ? new Date() : null,
        ...(blocked ? {} : { tempBlockedUntil: null }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning(adminUserColumns);
    return user ?? null;
  }

  async setTempBlocked(id: string, until: Date): Promise<AdminUserRow | null> {
    const [user] = await db
      .update(users)
      .set({ tempBlockedUntil: until, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(adminUserColumns);
    return user ?? null;
  }

  async clearTempBlock(id: string): Promise<AdminUserRow | null> {
    const [user] = await db
      .update(users)
      .set({ tempBlockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(adminUserColumns);
    return user ?? null;
  }

  async getCounts(
    userId: string,
  ): Promise<{ reviews: number; comments: number; votes: number; reports: number }> {
    const [reviewCount, commentCount, voteCount, reportCount] = await Promise.all([
      db.select({ total: count() }).from(reviews).where(eq(reviews.userId, userId)),
      db.select({ total: count() }).from(comments).where(eq(comments.userId, userId)),
      db.select({ total: count() }).from(reviewVotes).where(eq(reviewVotes.userId, userId)),
      db.select({ total: count() }).from(reports).where(eq(reports.userId, userId)),
    ]);

    return {
      reviews: reviewCount[0]?.total ?? 0,
      comments: commentCount[0]?.total ?? 0,
      votes: voteCount[0]?.total ?? 0,
      reports: reportCount[0]?.total ?? 0,
    };
  }

  /**
   * Delete everything a user ever posted and return the ids of the companies
   * whose stats are now stale.
   *
   * Ordering matters because the foreign keys are not cascading: reports and
   * comments reference reviews, and comments reference each other. Comments are
   * removed as one set so a reply never outlives the comment it points at.
   */
  async deleteContentWithClient(
    client: DbClient,
    userId: string,
  ): Promise<string[]> {
    // 1. The user's own reviews, and the companies they count toward.
    const ownReviews = await client
      .select({ id: reviews.id, companyId: reviews.companyId })
      .from(reviews)
      .where(eq(reviews.userId, userId));
    const ownReviewIds = ownReviews.map((r) => r.id);
    const companyIds = [...new Set(ownReviews.map((r) => r.companyId))];

    // 2. The user's own comments, expanded recursively through replies so no
    //    reply is left with a dangling parentId.
    const commentIdsToDelete = new Set<number>();
    const ownComments = await client
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.userId, userId));
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

    // 3. Comments by anyone else on the user's reviews — they die with them.
    if (ownReviewIds.length > 0) {
      const commentsOnReviews = await client
        .select({ id: comments.id })
        .from(comments)
        .where(inArray(comments.reviewId, ownReviewIds));
      for (const c of commentsOnReviews) commentIdsToDelete.add(c.id);
    }

    // 4. Reports filed by the user, or pointing at any of the doomed content.
    const reportConditions: SQL[] = [eq(reports.userId, userId)];
    if (ownReviewIds.length > 0) {
      reportConditions.push(inArray(reports.reviewId, ownReviewIds));
    }
    if (commentIdsToDelete.size > 0) {
      reportConditions.push(inArray(reports.commentId, [...commentIdsToDelete]));
    }
    await client.delete(reports).where(or(...reportConditions));

    // 5. The comments themselves (own + replies + comments on own reviews).
    if (commentIdsToDelete.size > 0) {
      await client.delete(comments).where(inArray(comments.id, [...commentIdsToDelete]));
    }

    // 6. Votes on the user's reviews (by anyone) plus the user's own votes,
    //    their reviews' tags, and finally the reviews.
    if (ownReviewIds.length > 0) {
      await client.delete(reviewVotes).where(
        or(inArray(reviewVotes.reviewId, ownReviewIds), eq(reviewVotes.userId, userId)),
      );
      await client.delete(reviewTags).where(inArray(reviewTags.reviewId, ownReviewIds));
      await client.delete(reviews).where(inArray(reviews.id, ownReviewIds));
    } else {
      // The user voted/commented but never wrote a review of their own.
      await client.delete(reviewVotes).where(eq(reviewVotes.userId, userId));
    }

    return companyIds;
  }

  /** Delete the user row itself. Call after deleteContentWithClient(). */
  async deleteWithClient(client: DbClient, userId: string): Promise<void> {
    await client.delete(users).where(eq(users.id, userId));
  }
}

export const adminUsersRepository = new AdminUsersRepository();
