import { reviewsRepository } from '../repository/reviews.repository.js';
import { companiesRepository } from '../../companies/repository/companies.repository.js';
import { db } from '../../../database/db.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { CreateReviewInput } from '../types/reviews.types.js';

class ReviewsService {
  async create(input: CreateReviewInput & { anonymousId: string }) {
    // Verify company exists (lookup by slug)
    const company = await companiesRepository.findBySlug(input.companySlug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    // A reviewer should not review the same company more than once. The rate
    // limit alone is not a reliable guard, so enforce it here too.
    const existing = await reviewsRepository.findByAnonymousAndCompany(
      input.anonymousId,
      company.id,
    );
    if (existing) {
      throw new AppError('You have already reviewed this company.', 409);
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
      });

      const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, company.id);
      await companiesRepository.updateStatsWithClient(tx, company.id, stats);

      return created;
    });

    return review;
  }

  async getByPublicId(publicId: string) {
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

  async listAll(page: number, limit: number, sortBy?: string) {
    return reviewsRepository.findAll({ page, limit, sortBy });
  }
}

export const reviewsService = new ReviewsService();
