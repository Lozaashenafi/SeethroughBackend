import { eq, and, desc, count, sql, inArray, or, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, type DatabaseTx } from '../../../database/db.js';
import { reviews } from '../../../database/schema/review.js';
import { companies } from '../../../database/schema/company.js';
import { users } from '../../../database/schema/user.js';
import { reviewTags } from '../../../database/schema/reviewTag.js';
import { comments } from '../../../database/schema/comment.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reports } from '../../../database/schema/report.js';
import type { CreateReviewInput } from '../types/reviews.types.js';

type DbClient = typeof db | DatabaseTx;

type CreateReviewRecord = CreateReviewInput & {
  userId: string;
  companyId: string;
  status: 'published' | 'pending' | 'rejected';
  contentFingerprint: string;
};

const reviewColumns = {
  id: reviews.id,
  publicId: reviews.publicId,
  userId: reviews.userId,
  companyId: reviews.companyId,
  companyName: companies.name,
  companySlug: companies.slug,
  title: reviews.title,
  pros: reviews.pros,
  cons: reviews.cons,
  overallRating: reviews.overallRating,
  workLifeBalance: reviews.workLifeBalance,
  culture: reviews.culture,
  management: reviews.management,
  compensation: reviews.compensation,
  opportunities: reviews.opportunities,
  isCurrentEmployee: reviews.isCurrentEmployee,
  employmentStatus: reviews.employmentStatus,
  jobTitle: reviews.jobTitle,
  isVerified: reviews.isVerified,
  showName: reviews.showName,
  reviewerName: reviews.reviewerName,
  status: reviews.status,
  helpfulCount: reviews.helpfulCount,
  unhelpfulCount: reviews.unhelpfulCount,
  createdAt: reviews.createdAt,
  updatedAt: reviews.updatedAt,
};

interface ReviewRow {
  id: number;
  publicId: string;
  userId: string;
  companyId: string;
  companyName: string | null;
  companySlug: string | null;
  title: string;
  pros: string | null;
  cons: string | null;
  overallRating: number | null;
  workLifeBalance: number | null;
  culture: number | null;
  management: number | null;
  compensation: number | null;
  opportunities: number | null;
  isCurrentEmployee: boolean | null;
  employmentStatus: string | null;
  jobTitle: string | null;
  isVerified: boolean;
  showName: boolean;
  reviewerName: string | null;
  status: 'published' | 'pending' | 'rejected';
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const adminReviewColumns = {
  ...reviewColumns,
  authorEmail: users.email,
  authorDisplayName: users.displayName,
};

interface AdminReviewRow extends ReviewRow {
  authorEmail: string;
  authorDisplayName: string;
}

export class ReviewsRepository {
  async create(input: CreateReviewRecord): Promise<ReviewRow> {
    return this.createWithClient(db, input);
  }

  async createWithClient(client: DbClient, input: CreateReviewRecord): Promise<ReviewRow> {
    const publicId = nanoid(16);

    // If showName is true, look up the user's display name to store on the review
    let reviewerName: string | null = null;
    if (input.showName) {
      const [user] = await client
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      reviewerName = user?.displayName ?? null;
    }

    const [review] = await client
      .insert(reviews)
      .values({
        publicId,
        userId: input.userId,
        companyId: input.companyId,
        title: input.title,
        pros: input.pros ?? null,
        cons: input.cons ?? null,
        overallRating: input.overallRating ?? null,
        workLifeBalance: input.workLifeBalance ?? null,
        culture: input.culture ?? null,
        management: input.management ?? null,
        compensation: input.compensation ?? null,
        opportunities: input.opportunities ?? null,
        isCurrentEmployee: input.isCurrentEmployee ?? null,
        employmentStatus: input.employmentStatus ?? null,
        jobTitle: input.jobTitle ?? null,
        contentFingerprint: input.contentFingerprint,
        showName: input.showName ?? false,
        reviewerName,
        status: input.status,
      })
      .returning();

    // Insert tags if provided
    if (input.tagIds && input.tagIds.length > 0) {
      await client.insert(reviewTags).values(
        input.tagIds.map((tagId) => ({
          reviewId: review.id,
          tagId,
        })),
      );
    }

    // Fetch the complete review with company data
    return (await this.findByIdWithClient(client, review.id))!;
  }

  async findByPublicId(publicId: string): Promise<ReviewRow | null> {
    return this.findByPublicIdWithClient(db, publicId);
  }

  async findAdminByPublicId(publicId: string): Promise<AdminReviewRow | null> {
    const [review] = await db
      .select(adminReviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.publicId, publicId));
    return review ?? null;
  }

  async findByPublicIdWithClient(client: DbClient, publicId: string): Promise<ReviewRow | null> {
    const [review] = await client
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.publicId, publicId));
    return review ?? null;
  }

  async findById(id: number): Promise<ReviewRow | null> {
    return this.findByIdWithClient(db, id);
  }

  async findByUserAndCompany(
    userId: string,
    companyId: string,
  ): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(and(eq(reviews.userId, userId), eq(reviews.companyId, companyId)));
    return review ?? null;
  }

  /** Recent published reviews for near-duplicate content screening. */
  async findRecentForDupCheck(since: Date, limit: number): Promise<ReviewRow[]> {
    return db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(and(eq(reviews.status, 'published'), sql`${reviews.createdAt} >= ${since}`))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  }

  /** All reviews (any moderation status) authored by a user, newest first. */
  async findByUserId(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: ReviewRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.userId, userId));

    return { data, total: totalResult?.total ?? 0 };
  }

  /** Every review (any moderation status) authored by a user, newest first. */
  async findAllByUserId(userId: string, limit = 1000): Promise<ReviewRow[]> {
    return db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  }

  /** Find a review whose content fingerprint matches (exact duplicate check). */
  async findByFingerprint(fingerprint: string): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.contentFingerprint, fingerprint))
      .limit(1);
    return review ?? null;
  }

  async findByIdWithClient(client: DbClient, id: number): Promise<ReviewRow | null> {
    const [review] = await client
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.id, id));
    return review ?? null;
  }

  async findByCompanyId(
    companyId: string,
    params: { page: number; limit: number; sortBy?: string },
  ): Promise<{ data: ReviewRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const orderBy =
      params.sortBy === 'engagement'
        ? desc(sql`${reviews.helpfulCount} + ${reviews.unhelpfulCount}`)
        : desc(reviews.createdAt);

    const whereClause = and(eq(reviews.companyId, companyId), eq(reviews.status, 'published'));

    const data = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviews)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  async deleteByPublicIdWithClient(client: DbClient, publicId: string): Promise<boolean> {
    // First find the review to get its internal ID for child records
    const review = await this.findByPublicIdWithClient(client, publicId);
    if (!review) return false;

    // The service wraps this in an outer db.transaction(), so no nested
    // transaction is needed here — the caller already guarantees atomicity.
    // Collect comment IDs so reports referencing them can be removed too
    const reviewComments = await client
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.reviewId, review.id));
    const commentIds = reviewComments.map((c) => c.id);

    // Delete child records first to avoid FK violations.
    // Reports may reference the review directly or one of its comments.
    const reportConditions: SQL[] = [eq(reports.reviewId, review.id)];
    if (commentIds.length > 0) {
      reportConditions.push(inArray(reports.commentId, commentIds));
    }

    await client.delete(reports).where(or(...reportConditions));
    await client.delete(comments).where(eq(comments.reviewId, review.id));
    await client.delete(reviewVotes).where(eq(reviewVotes.reviewId, review.id));
    await client.delete(reviewTags).where(eq(reviewTags.reviewId, review.id));

    const [deleted] = await client
      .delete(reviews)
      .where(eq(reviews.publicId, publicId))
      .returning({ id: reviews.id });
    return !!deleted;
  }

  /**
   * Update an existing review's editable fields. Undefined values are left
   * untouched; null values clear the field. Returns the refreshed row (with
   * company joins) or null when the review no longer exists.
   */
  async updateWithClient(
    client: DbClient,
    id: number,
    input: Partial<{
      title: string;
      pros: string | null;
      cons: string | null;
      overallRating: number | null;
      workLifeBalance: number | null;
      culture: number | null;
      management: number | null;
      compensation: number | null;
      opportunities: number | null;
      isCurrentEmployee: boolean | null;
      employmentStatus: string | null;
      jobTitle: string | null;
      status: 'published' | 'pending' | 'rejected';
      contentFingerprint: string;
    }>,
  ): Promise<ReviewRow | null> {
    const fields = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );

    const [updated] = await client
      .update(reviews)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id, publicId: reviews.publicId });

    if (!updated) return null;
    return this.findByIdWithClient(client, updated.id);
  }

  /** Replace a review's tag links wholesale (delete old, insert new). */
  async replaceTagsWithClient(
    client: DbClient,
    reviewId: number,
    tagIds: number[],
  ): Promise<void> {
    await client.delete(reviewTags).where(eq(reviewTags.reviewId, reviewId));
    if (tagIds.length > 0) {
      await client
        .insert(reviewTags)
        .values(tagIds.map((tagId) => ({ reviewId, tagId })));
    }
  }

  /** The tag ids attached to a review. */
  async findTagsByReviewId(reviewId: number): Promise<number[]> {
    const rows = await db
      .select({ tagId: reviewTags.tagId })
      .from(reviewTags)
      .where(eq(reviewTags.reviewId, reviewId));
    return rows.map((r) => r.tagId);
  }

  async updateCounts(
    id: number,
    counts: { helpfulCount: number; unhelpfulCount: number },
  ): Promise<void> {
    return this.updateCountsWithClient(db, id, counts);
  }

  async updateCountsWithClient(
    client: DbClient,
    id: number,
    counts: { helpfulCount: number; unhelpfulCount: number },
  ): Promise<void> {
    await client
      .update(reviews)
      .set({
        helpfulCount: counts.helpfulCount,
        unhelpfulCount: counts.unhelpfulCount,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id));
  }

  async findAllWithStatus(
    params: { page: number; limit: number; status?: string; sortBy?: string },
  ): Promise<{ data: AdminReviewRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const orderBy = params.sortBy === 'engagement'
      ? desc(sql`${reviews.helpfulCount} + ${reviews.unhelpfulCount}`)
      : desc(reviews.createdAt);

    const conditions: SQL[] = [];
    if (params.status && params.status !== 'all') {
      conditions.push(eq(reviews.status, params.status as 'published' | 'pending' | 'rejected'));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select(adminReviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviews)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  async updateStatus(id: number, status: 'published' | 'pending' | 'rejected'): Promise<ReviewRow | null> {
    const [review] = await db
      .update(reviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id, publicId: reviews.publicId });

    if (!review) return null;
    return this.findByPublicId(review.publicId);
  }

  async setStatusWithClient(
    client: DbClient,
    id: number,
    status: 'published' | 'pending' | 'rejected',
  ): Promise<void> {
    await client
      .update(reviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(reviews.id, id));
  }

  async getCompanyReviewStats(
    companyId: string,
  ): Promise<{ averageRating: string | null; reviewCount: number; recommendationRate: number }> {
    return this.getCompanyReviewStatsWithClient(db, companyId);
  }

  async getCompanyReviewStatsWithClient(
    client: DbClient,
    companyId: string,
  ): Promise<{ averageRating: string | null; reviewCount: number; recommendationRate: number }> {
    // Aggregate in SQL so we never pull every review row into memory. Only
    // published reviews contribute to the public stats — pending/rejected
    // content must never move the averages or counts.
    const [result] = await client
      .select({
        averageRating: sql<string>`round(avg(${reviews.overallRating}), 1)::text`,
        reviewCount: count(),
        recommendationRate: sql<number>`round((count(*) FILTER (WHERE ${reviews.isCurrentEmployee} = true)::numeric / nullif(count(*), 0)) * 100)::int`,
      })
      .from(reviews)
      .where(and(eq(reviews.companyId, companyId), eq(reviews.status, 'published')));

    return {
      averageRating: result?.averageRating ?? null,
      reviewCount: result?.reviewCount ?? 0,
      recommendationRate: result?.recommendationRate ?? 0,
    };
  }
}

export const reviewsRepository = new ReviewsRepository();
