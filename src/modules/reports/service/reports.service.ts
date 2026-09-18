import { reportsRepository } from '../repository/reports.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { commentsRepository } from '../../comments/repository/comments.repository.js';
import { companiesRepository } from '../../companies/repository/companies.repository.js';
import { adminUsersRepository } from '../../user-auth/repository/adminUsers.repository.js';
import { db } from '../../../database/db.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { findBadWords } from '../../../shared/utils/index.js';
import type { ReportStatus } from '../types/reports.types.js';

const REPORT_THRESHOLD = 10;
const BAN_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 1 month

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

    // One report per user per review/comment
    if (reviewId) {
      const existing = await reportsRepository.findByUserAndReview(input.userId, reviewId);
      if (existing) {
        throw new AppError('You have already reported this review', 409);
      }
    }
    if (commentId) {
      const existing = await reportsRepository.findByUserAndComment(input.userId, commentId);
      if (existing) {
        throw new AppError('You have already reported this comment', 409);
      }
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
    const updated = await reportsRepository.updateStatus(report.id, status);

    // Auto-enforce: if a review report is approved and reaches 10 resolved
    // reports, delete the review and temp-ban the author for 1 month.
    if (status === 'resolved' && report.reviewId) {
      const resolvedCount = await reportsRepository.countResolvedByReviewId(report.reviewId);
      if (resolvedCount >= REPORT_THRESHOLD) {
        const review = await reviewsRepository.findById(report.reviewId);
        if (review) {
          await db.transaction(async (tx) => {
            await reviewsRepository.deleteByPublicIdWithClient(tx, review.publicId);
            const stats = await reviewsRepository.getCompanyReviewStatsWithClient(tx, review.companyId);
            await companiesRepository.updateStatsWithClient(tx, review.companyId, stats);
          });
          await adminUsersRepository.setTempBlocked(
            review.userId,
            new Date(Date.now() + BAN_DURATION_MS),
          );
        }
      }
    }

    return updated;
  }
}

export const reportsService = new ReportsService();
