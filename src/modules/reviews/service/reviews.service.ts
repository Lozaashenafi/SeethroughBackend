import { reviewsRepository } from '../repository/reviews.repository.js';
import { companiesRepository } from '../../companies/repository/companies.repository.js';
import { db } from '../../../database/db.js';
import { AppError } from '../../../shared/errors/AppError.js';
import {
  contentFingerprint,
  textSimilarity,
  NEAR_DUPLICATE_THRESHOLD,
} from '../../../shared/utils/index.js';
import type { CreateReviewInput } from '../types/reviews.types.js';

// One review per company per identity per 30 days.
const REVIEW_REPEAT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// Near-duplicate screening window — how far back we compare content.
const DUP_SCREEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// How many recently-published reviews we compare against for near-duplicates.
const DUP_SCREEN_LIMIT = 200;

class ReviewsService {
  async create(input: CreateReviewInput & { anonymousId: string }) {
    // Verify company exists (lookup by slug)
    const company = await companiesRepository.findBySlug(input.companySlug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    // One review per company per identity per 30 days. The rate limit alone is
    // not a reliable guard, so enforce the window here too.
    const recent = await reviewsRepository.findRecentByAnonymousAndCompany(
      input.anonymousId,
      company.id,
      new Date(Date.now() - REVIEW_REPEAT_WINDOW_MS),
    );
    if (recent) {
      throw new AppError('You have already reviewed this company recently. Please try again later.', 409);
    }

    // Validate ratings are within range
    const ratings = [
      input.overallRating,
      input.workLifeBalance,
      input.culture,
      input.management,
      input.compensation,
      input.opportunities,
    ].filter((r): r is number => r !== undefined);

    for (const rating of ratings) {
      if (rating < 1 || rating > 5) {
        throw new AppError('Ratings must be between 1 and 5', 400);
      }
    }

    // Duplicate / near-identical detection. A reviewer resubmitting their own
    // content is rejected outright; content nearly identical to someone else's
    // recent published review is routed to moderation.
    const fingerprint = contentFingerprint(input.title, input.pros, input.cons);
    const exactDup = await reviewsRepository.findByFingerprint(fingerprint);
    if (exactDup) {
      throw new AppError('This review appears to be a duplicate. If this was a mistake, please try again.', 409);
    }

    let status: 'published' | 'pending' | 'rejected' = 'published';
    const recentPublished = await reviewsRepository.findRecentForDupCheck(
      new Date(Date.now() - DUP_SCREEN_WINDOW_MS),
      DUP_SCREEN_LIMIT,
    );
    const nearDup = recentPublished.find(
      (r) =>
        textSimilarity(input.title, r.title) >= NEAR_DUPLICATE_THRESHOLD ||
        textSimilarity(input.pros ?? '', r.pros ?? '') >= NEAR_DUPLICATE_THRESHOLD ||
        textSimilarity(input.cons ?? '', r.cons ?? '') >= NEAR_DUPLICATE_THRESHOLD,
    );

    if (nearDup) {
      status = 'pending';
    }

    // Review insert, tag links and company stats update are committed
    // atomically so a failure never leaves a half-created review or stale stats.
    const review = await db.transaction(async (tx) => {
      const created = await reviewsRepository.createWithClient(tx, {
        anonymousId: input.anonymousId,
        companyId: company.id,
        companySlug: input.companySlug,
        title: input.title,
        pros: input.pros,
        cons: input.cons,
        overallRating: input.overallRating,
        workLifeBalance: input.workLifeBalance,
        culture: input.culture,
        management: input.management,
        compensation: input.compensation,
        opportunities: input.opportunities,
        isCurrentEmployee: input.isCurrentEmployee,
        employmentStatus: input.employmentStatus,
        jobTitle: input.jobTitle,
        tagIds: input.tagIds,
        status,
        contentFingerprint: fingerprint,
      });

      // Only published reviews count toward the company's public stats.
      if (status === 'published') {
        const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, company.id);
        await companiesRepository.updateStatsWithClient(tx, company.id, stats);
      }

      return created;
    });

    return review;
  }

  /**
   * Edit a review by its author. Ownership is enforced with a 404 (never 403)
   * so a third party can't even confirm a review exists. Ratings, content,
   * job details and tags are updatable; the company is not. A near-duplicate
   * edit routes the review back to moderation (excluding the review itself).
   */
  async update(
    publicId: string,
    anonymousId: string,
    input: Omit<CreateReviewInput, 'companySlug'>,
  ) {
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review || review.anonymousId !== anonymousId) {
      throw new AppError('Review not found', 404);
    }

    const ratings = [
      input.overallRating,
      input.workLifeBalance,
      input.culture,
      input.management,
      input.compensation,
      input.opportunities,
    ].filter((r): r is number => r !== undefined);

    for (const rating of ratings) {
      if (rating < 1 || rating > 5) {
        throw new AppError('Ratings must be between 1 and 5', 400);
      }
    }

    // Merge provided values over the current ones, then re-fingerprint so
    // future duplicate checks screen the latest text.
    const merged = {
      title: input.title ?? review.title,
      pros: input.pros !== undefined ? input.pros : review.pros,
      cons: input.cons !== undefined ? input.cons : review.cons,
      overallRating: input.overallRating ?? review.overallRating,
      workLifeBalance: input.workLifeBalance ?? review.workLifeBalance,
      culture: input.culture ?? review.culture,
      management: input.management ?? review.management,
      compensation: input.compensation ?? review.compensation,
      opportunities: input.opportunities ?? review.opportunities,
      isCurrentEmployee: input.isCurrentEmployee ?? review.isCurrentEmployee,
      employmentStatus: input.employmentStatus ?? review.employmentStatus,
      jobTitle: input.jobTitle ?? review.jobTitle,
    };

    const fingerprint = contentFingerprint(
      merged.title,
      merged.pros ?? '',
      merged.cons ?? '',
    );

    let status: 'published' | 'pending' | 'rejected' = review.status;
    if (status === 'published') {
      const recentPublished = await reviewsRepository.findRecentForDupCheck(
        new Date(Date.now() - DUP_SCREEN_WINDOW_MS),
        DUP_SCREEN_LIMIT,
      );
      const others = recentPublished.filter((r) => r.id !== review.id);
      const nearDup = others.find(
        (r) =>
          textSimilarity(merged.title, r.title) >= NEAR_DUPLICATE_THRESHOLD ||
          textSimilarity(merged.pros ?? '', r.pros ?? '') >= NEAR_DUPLICATE_THRESHOLD ||
          textSimilarity(merged.cons ?? '', r.cons ?? '') >= NEAR_DUPLICATE_THRESHOLD,
      );
      if (nearDup) {
        status = 'pending';
      }
    }

    const updated = await db.transaction(async (tx) => {
      const result = await reviewsRepository.updateWithClient(tx, review.id, {
        ...merged,
        status,
        contentFingerprint: fingerprint,
      });
      if (!result) {
        throw new AppError('Failed to update review', 500);
      }

      if (input.tagIds) {
        await reviewsRepository.replaceTagsWithClient(tx, review.id, input.tagIds);
      }

      // Ratings and/or moderation status may have changed, so the company's
      // public stats are recomputed in the same transaction as the edit.
      const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, review.companyId);
      await companiesRepository.updateStatsWithClient(tx, review.companyId, stats);

      return result;
    });

    return updated;
  }

  /**
   * Tag ids for a review (used to prefill the edit form). Public callers may
   * only read tags of published reviews; the review's author may read tags
   * regardless of moderation status so the edit form can prefill honestly.
   */
  async getTags(publicId: string, anonymousId?: string): Promise<number[]> {
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }
    const isOwner = anonymousId !== undefined && review.anonymousId === anonymousId;
    if (review.status !== 'published' && !isOwner) {
      throw new AppError('Review not found', 404);
    }
    return reviewsRepository.findTagsByReviewId(review.id);
  }

  async getByPublicId(publicId: string) {
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }
    if (review.status !== 'published') {
      throw new AppError('Review not found', 404);
    }
    return review;
  }

  async adminGetByPublicId(publicId: string) {
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }
    return review;
  }

  async listByCompanySlug(companySlug: string, page: number, limit: number, sortBy?: string) {
    const company = await companiesRepository.findBySlug(companySlug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    return reviewsRepository.findByCompanyId(company.id, { page, limit, sortBy });
  }

  async deleteByPublicId(publicId: string) {
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Cascade delete and company stats recompute happen in one transaction so
    // the denormalized counters can never drift from the actual review set.
    const deleted = await db.transaction(async (tx) => {
      const ok = await reviewsRepository.deleteByPublicIdWithClient(tx, publicId);
      if (!ok) return false;

      const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, review.companyId);
      await companiesRepository.updateStatsWithClient(tx, review.companyId, stats);
      return true;
    });

    if (!deleted) {
      throw new AppError('Failed to delete review', 500);
    }
  }

  async listAll(params: { page: number; limit: number; status?: string; sortBy?: string }) {
    // Public consumers never pass a status; only published reviews may be shown.
    // Admin callers pass an explicit status (or 'all') via the admin endpoint.
    const status = params.status ?? 'published';
    return reviewsRepository.findAllWithStatus({ ...params, status });
  }

  async moderate(publicId: string, status: 'published' | 'rejected') {
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }
    if (review.status === 'published' && status === 'published') {
      throw new AppError('Review is already published', 409);
    }

    const updated = await reviewsRepository.updateStatus(review.id, status);
    if (!updated) {
      throw new AppError('Failed to update review status', 500);
    }

    // Recompute company stats when a review transitions in/out of the public set.
    await db.transaction(async (tx) => {
      const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, review.companyId);
      await companiesRepository.updateStatsWithClient(tx, review.companyId, stats);
    });

    return updated;
  }
}

export const reviewsService = new ReviewsService();
