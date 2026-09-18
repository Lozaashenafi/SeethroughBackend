import { commentsRepository } from '../repository/comments.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { notificationsService } from '../../notifications/service/notifications.service.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { findBadWords } from '../../../shared/utils/index.js';

class CommentsService {
  async create(input: {
    userId: string;
    reviewPublicId: string;
    content: string;
    parentPublicId?: string;
  }) {
    // Profanity gate — block the comment and tell the author exactly which
    // words to fix before anything is persisted.
    const badWords = findBadWords(input.content);
    if (badWords.length > 0) {
      throw new AppError(
        `Your comment contains inappropriate language (${badWords.join(', ')}). Please remove or reword it before posting.`,
        400,
      );
    }

    // Look up the review
    const review = await reviewsRepository.findByPublicId(input.reviewPublicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Users cannot comment on their own review
    if (review.userId === input.userId) {
      throw new AppError('You cannot comment on your own review', 403);
    }

    // If a parent is referenced, resolve its publicId to the internal DB id
    // and verify it exists and belongs to the same review.
    let parentId: number | undefined;
    if (input.parentPublicId) {
      const parentComment = await commentsRepository.findByPublicId(input.parentPublicId);
      if (!parentComment) {
        throw new AppError('Parent comment not found', 404);
      }
      if (parentComment.reviewId !== review.id) {
        throw new AppError('Parent comment does not belong to this review', 400);
      }
      parentId = parentComment.id;
    }

    const comment = await commentsRepository.create({
      userId: input.userId,
      reviewId: review.id,
      content: input.content,
      parentId,
      parentPublicId: input.parentPublicId,
    });

    // Notify the review author (don't notify yourself)
    if (review.userId !== input.userId) {
      notificationsService.create({
        userId: review.userId,
        type: 'comment',
        reviewPublicId: input.reviewPublicId,
        message: 'Someone commented on your review',
      });
    }

    return comment;
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
