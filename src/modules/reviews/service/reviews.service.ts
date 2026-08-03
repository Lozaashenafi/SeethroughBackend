import { reviewsRepository } from '../repository/reviews.repository.js';
import { companiesRepository } from '../../companies/repository/companies.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { CreateReviewInput } from '../types/reviews.types.js';

class ReviewsService {
  async create(input: CreateReviewInput & { anonymousId: string }) {
    // Verify company exists (lookup by slug)
    const company = await companiesRepository.findBySlug(input.companySlug);
    if (!company) {
      throw new AppError('Company not found', 404);
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

    const review = await reviewsRepository.create({
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

    // Update company stats
    const stats = await reviewsRepository.getCompanyReviewStats(company.id);
    await companiesRepository.updateStats(company.id, stats);

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

    const deleted = await reviewsRepository.deleteByPublicId(publicId);
    if (!deleted) {
      throw new AppError('Failed to delete review', 500);
    }

    // Update company stats (recalculate without this review)
    const stats = await reviewsRepository.getCompanyReviewStats(review.companyId);
    await companiesRepository.updateStats(review.companyId, stats);
  }

  async listAll(page: number, limit: number, sortBy?: string) {
    return reviewsRepository.findAll({ page, limit, sortBy });
  }
}

export const reviewsService = new ReviewsService();
