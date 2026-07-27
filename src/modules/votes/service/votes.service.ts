import { votesRepository } from '../repository/votes.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';

class VotesService {
  async vote(input: {
    anonymousId: string;
    reviewPublicId: string;
    voteType: 'helpful' | 'unhelpful';
  }) {
    // Look up the review
    const review = await reviewsRepository.findByPublicId(input.reviewPublicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Upsert the vote
    const vote = await votesRepository.upsert({
      reviewId: review.id,
      anonymousId: input.anonymousId,
      voteType: input.voteType,
    });

    // Update review counts
    const counts = await votesRepository.getVoteCounts(review.id);
    await reviewsRepository.updateCounts(review.id, {
      helpfulCount: counts.helpful,
      unhelpfulCount: counts.unhelpful,
    });

    return vote;
  }
}

export const votesService = new VotesService();
