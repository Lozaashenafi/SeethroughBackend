import { eq, desc, count, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../../database/db.js';
import { reviews } from '../../../database/schema/review.js';
import { companies } from '../../../database/schema/company.js';
import { reviewTags } from '../../../database/schema/reviewTag.js';
import { comments } from '../../../database/schema/comment.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reports } from '../../../database/schema/report.js';
import type { CreateReviewInput } from '../types/reviews.types.js';

const reviewColumns = {
  id: reviews.id,
  publicId: reviews.publicId,
  anonymousId: reviews.anonymousId,
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
  helpfulCount: reviews.helpfulCount,
  unhelpfulCount: reviews.unhelpfulCount,
  createdAt: reviews.createdAt,
  updatedAt: reviews.updatedAt,
};

interface ReviewRow {
  id: number;
  publicId: string;
  anonymousId: string;
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
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewsRepository {
  async create(input: CreateReviewInput & { anonymousId: string; companyId: string }): Promise<ReviewRow> {
    const publicId = nanoid(16);

    const [review] = await db
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
      })
      .returning();

    // Insert tags if provided
    if (input.tagIds && input.tagIds.length > 0) {
      await db.insert(reviewTags).values(
        input.tagIds.map((tagId) => ({
          reviewId: review.id,
          tagId,
        })),
      );
    }

    // Fetch the complete review with company data
    return (await this.findById(review.id))!;
  }

  async findByPublicId(publicId: string): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.publicId, publicId));
    return review ?? null;
  }

  async findById(id: number): Promise<ReviewRow | null> {
    const [review] = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.id, id));
    return review ?? null;
  }

  async findByCompanyId(
    companyId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: ReviewRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.companyId, companyId))
      .orderBy(desc(reviews.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.companyId, companyId));

    return { data, total: totalResult?.total ?? 0 };
  }

  async deleteByPublicId(publicId: string): Promise<boolean> {
    // First find the review to get its internal ID for child records
    const review = await this.findByPublicId(publicId);
    if (!review) return false;

    // Delete child records first to avoid FK violations
    await db.delete(comments).where(eq(comments.reviewId, review.id));
    await db.delete(reviewVotes).where(eq(reviewVotes.reviewId, review.id));
    await db.delete(reviewTags).where(eq(reviewTags.reviewId, review.id));
    await db.delete(reports).where(eq(reports.reviewId, review.id));

    const [deleted] = await db
      .delete(reviews)
      .where(eq(reviews.publicId, publicId))
      .returning({ id: reviews.id });
    return !!deleted;
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

  async findAll(params: { page: number; limit: number; sortBy?: string }): Promise<{ data: ReviewRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const orderBy = params.sortBy === 'engagement'
      ? desc(sql`${reviews.helpfulCount} + ${reviews.unhelpfulCount}`)
      : desc(reviews.createdAt);

    const data = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviews);

    return { data, total: totalResult?.total ?? 0 };
  }

  async getCompanyReviewStats(
    companyId: string,
  ): Promise<{ averageRating: string | null; reviewCount: number; recommendationRate: number }> {
    const allReviews = await db
      .select({
        overallRating: reviews.overallRating,
        isCurrentEmployee: reviews.isCurrentEmployee,
      })
      .from(reviews)
      .where(eq(reviews.companyId, companyId));

    const reviewCount = allReviews.length;
    const ratings = allReviews
      .filter((r) => r.overallRating !== null)
      .map((r) => r.overallRating!);
    const averageRating =
      ratings.length > 0
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : null;
    const recommendationRate =
      reviewCount > 0
        ? Math.round(
            (allReviews.filter((r) => r.isCurrentEmployee === true).length / reviewCount) *
              100,
          )
        : 0;

    return { averageRating, reviewCount, recommendationRate };
  }
}

export const reviewsRepository = new ReviewsRepository();
