import { commentsRepository } from '../repository/comments.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';

class CommentsService {
  async create(input: {
    anonymousId: string;
    reviewPublicId: string;
    content: string;
    parentId?: number;
  }) {
    // Look up the review
    const review = await reviewsRepository.findByPublicId(input.reviewPublicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // If parentId is provided, verify it exists
    if (input.parentId) {
      const parentComment = await commentsRepository.findById(input.parentId);
      if (!parentComment) {
        throw new AppError('Parent comment not found', 404);
      }
      // Ensure parent comment belongs to the same review
      if (parentComment.reviewId !== review.id) {
        throw new AppError('Parent comment does not belong to this review', 400);
      }
    }

    return commentsRepository.create({
      anonymousId: input.anonymousId,
      reviewId: review.id,
      content: input.content,
      parentId: input.parentId,
    });
  }

  async listByReview(reviewPublicId: string, page: number, limit: number) {
    const review = await reviewsRepository.findByPublicId(reviewPublicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }
    return commentsRepository.findByReviewId(review.id, { page, limit });
  }
}

export const commentsService = new CommentsService();
