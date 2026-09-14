import { reportsRepository } from '../repository/reports.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { commentsRepository } from '../../comments/repository/comments.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { findBadWords } from '../../../shared/utils/index.js';
import type { ReportStatus } from '../types/reports.types.js';

class ReportsService {
  async create(input: {
    userId: string;
    reviewPublicId?: string;
    commentPublicId?: string;
    reason: string;
    description?: string;
  }) {
    let reviewId: number | undefined;
    let commentId: number | undefined;

    // Resolve review publicId to internal ID
    if (input.reviewPublicId) {
      const review = await reviewsRepository.findByPublicId(input.reviewPublicId);
      if (!review) {
        throw new AppError('Review not found', 404);
      }
      reviewId = review.id;
    }

    // Resolve comment publicId to internal ID
    if (input.commentPublicId) {
      const comment = await commentsRepository.findByPublicId(input.commentPublicId);
      if (!comment) {
        throw new AppError('Comment not found', 404);
      }
      commentId = comment.id;
    }

    if (!reviewId && !commentId) {
      throw new AppError('Either reviewPublicId or commentPublicId must be provided', 400);
    }

    // Profanity gate — keep report descriptions civil too.
    const badWords = findBadWords(input.description ?? '');
    if (badWords.length > 0) {
      throw new AppError(
        `Your report contains inappropriate language (${badWords.join(', ')}). Please remove or reword it before submitting.`,
        400,
      );
    }

    return reportsRepository.create({
      userId: input.userId,
      reviewId,
      commentId,
      reason: input.reason,
      description: input.description,
    });
  }

  async list(params: {
    status?: ReportStatus;
    page: number;
    limit: number;
  }) {
    return reportsRepository.findAll(params);
  }

  async updateStatus(publicId: string, status: 'resolved' | 'dismissed') {
    const report = await reportsRepository.findByPublicId(publicId);
    if (!report) {
      throw new AppError('Report not found', 404);
    }
    return reportsRepository.updateStatus(report.id, status);
  }
}

export const reportsService = new ReportsService();
