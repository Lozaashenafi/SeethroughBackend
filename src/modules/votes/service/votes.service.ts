import { db } from '../../../database/db.js';
import { votesRepository } from '../repository/votes.repository.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';

class VotesService {
  async vote(input: {
    userId: string;
    reviewPublicId: string;
    voteType: 'helpful' | 'unhelpful';
  }) {
    const review = await reviewsRepository.findByPublicId(input.reviewPublicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Upsert the vote, recompute counts, and update the review — all inside a
    // single transaction so concurrent votes on the same review never lose an
    // increment due to a read-then-write race.
    const result = await db.transaction(async (tx) => {
      const vote = await votesRepository.upsertWithClient(tx, {
        reviewId: review.id,
        userId: input.userId,
        voteType: input.voteType,
      });

      const counts = await votesRepository.getVoteCountsWithClient(tx, review.id);
      await reviewsRepository.updateCountsWithClient(tx, review.id, {
        helpfulCount: counts.helpful,
        unhelpfulCount: counts.unhelpful,
      });

      return vote;
    });

    return result;
  }
}

export const votesService = new VotesService();
