import { eq, and, desc, count, sql, inArray, or, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, type DatabaseTx } from '../../../database/db.js';
import { reviews } from '../../../database/schema/review.js';
import { companies } from '../../../database/schema/company.js';
import { reviewTags } from '../../../database/schema/reviewTag.js';
import { comments } from '../../../database/schema/comment.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reports } from '../../../database/schema/report.js';
import { anonymousIdentities } from '../../../database/schema/anonymousIdentity.js';
import type { CreateReviewInput } from '../types/reviews.types.js';

type DbClient = typeof db | DatabaseTx;

type CreateReviewRecord = CreateReviewInput & {
  anonymousId: string;
  companyId: string;
  status: 'published' | 'pending' | 'rejected';
  contentFingerprint: string;
};

const reviewColumns = {
  id: reviews.id,
  publicId: reviews.publicId,
  anonymousId: reviews.anonymousId,
  nickname: anonymousIdentities.nickname,
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
  status: reviews.status,
  helpfulCount: reviews.helpfulCount,
  unhelpfulCount: reviews.unhelpfulCount,
  createdAt: reviews.createdAt,
  updatedAt: reviews.updatedAt,
};

interface ReviewRow {
  id: number;
  publicId: string;
  anonymousId: string;
  nickname: string | null;
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
  status: 'published' | 'pending' | 'rejected';
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewsRepository {
  async create(input: CreateReviewRecord): Promise<ReviewRow> {
    return this.createWithClient(db, input);
  }

  async createWithClient(client: DbClient, input: CreateReviewRecord): Promise<ReviewRow> {
    const publicId = nanoid(16);

    const [review] = await client
      .insert(reviews)
      .values({
        publicId,
        anonymousId: input.anonymousId,
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

  async findByPublicIdWithClient(client: DbClient, publicId: string): Promise<ReviewRow | null> {
    const [review] = await client
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(eq(reviews.publicId, publicId));
    return review ?? null;
  }

  async findById(id: number): Promise<ReviewRow | null> {
    return this.findByIdWithClient(db, id);
  }

  async findByAnonymousAndCompany(
    anonymousId: string,
    companyId: string,
  ): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(and(eq(reviews.anonymousId, anonymousId), eq(reviews.companyId, companyId)));
    return review ?? null;
  }

  /** Most recent review by this identity for the company created within `since`. */
  async findRecentByAnonymousAndCompany(
    anonymousId: string,
    companyId: string,
    since: Date,
  ): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(
        and(
          eq(reviews.anonymousId, anonymousId),
          eq(reviews.companyId, companyId),
          sql`${reviews.createdAt} >= ${since}`,
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(1);
    return review ?? null;
  }

  /** Recent published reviews for near-duplicate content screening. */
  async findRecentForDupCheck(since: Date, limit: number): Promise<ReviewRow[]> {
    return db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(and(eq(reviews.status, 'published'), sql`${reviews.createdAt} >= ${since}`))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  }

  /** All reviews (any moderation status) authored by an identity, newest first. */
  async findByAnonymousId(
    anonymousId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: ReviewRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(eq(reviews.anonymousId, anonymousId))
      .orderBy(desc(reviews.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.anonymousId, anonymousId));

    return { data, total: totalResult?.total ?? 0 };
  }

  /** Every review (any moderation status) authored by an identity, newest first. */
  async findAllByAnonymousId(anonymousId: string, limit = 1000): Promise<ReviewRow[]> {
    return db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(eq(reviews.anonymousId, anonymousId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  }

  /** Find a review whose content fingerprint matches (exact duplicate check). */
  async findByFingerprint(fingerprint: string): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
      .where(eq(reviews.contentFingerprint, fingerprint))
      .limit(1);
    return review ?? null;
  }

  async findByIdWithClient(client: DbClient, id: number): Promise<ReviewRow | null> {
    const [review] = await client
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
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
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
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

  async deleteByPublicId(publicId: string): Promise<boolean> {
    return this.deleteByPublicIdWithClient(db, publicId);
  }

  async deleteByPublicIdWithClient(client: DbClient, publicId: string): Promise<boolean> {
    // First find the review to get its internal ID for child records
    const review = await this.findByPublicIdWithClient(client, publicId);
    if (!review) return false;

    // Cascade delete in a single transaction for atomicity
    return client.transaction(async (tx) => {
      // Collect comment IDs so reports referencing them can be removed too
      const reviewComments = await tx
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

      await tx.delete(reports).where(or(...reportConditions));
      await tx.delete(comments).where(eq(comments.reviewId, review.id));
      await tx.delete(reviewVotes).where(eq(reviewVotes.reviewId, review.id));
      await tx.delete(reviewTags).where(eq(reviewTags.reviewId, review.id));

      const [deleted] = await tx
        .delete(reviews)
        .where(eq(reviews.publicId, publicId))
        .returning({ id: reviews.id });
      return !!deleted;
    });
  }

  async updateCounts(
    id: number,
    counts: { helpfulCount: number; unhelpfulCount: number },
  ): Promise<void> {
    await db
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
  ): Promise<{ data: ReviewRow[]; total: number }> {
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
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .leftJoin(anonymousIdentities, eq(reviews.anonymousId, anonymousIdentities.id))
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
