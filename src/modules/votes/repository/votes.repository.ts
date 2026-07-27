import { eq, and } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';

interface VoteRow {
  id: number;
  reviewId: number;
  anonymousId: string;
  voteType: string;
  createdAt: Date;
}

export class VotesRepository {
  async upsert(input: {
    reviewId: number;
    anonymousId: string;
    voteType: 'helpful' | 'unhelpful';
  }): Promise<VoteRow> {
    // Check for existing vote
    const [existing] = await db
      .select()
      .from(reviewVotes)
      .where(
        and(
          eq(reviewVotes.reviewId, input.reviewId),
          eq(reviewVotes.anonymousId, input.anonymousId as any),
        ),
      );

    if (existing) {
      // Update existing vote
      const [updated] = await db
        .update(reviewVotes)
        .set({
          voteType: input.voteType,
          createdAt: new Date(),
        })
        .where(eq(reviewVotes.id, existing.id))
        .returning();
      return updated;
    }

    // Create new vote
    const [created] = await db
      .insert(reviewVotes)
      .values({
        reviewId: input.reviewId,
        anonymousId: input.anonymousId as any,
        voteType: input.voteType,
      })
      .returning();
    return created;
  }

  async findByReviewAndAnonymous(
    reviewId: number,
    anonymousId: string,
  ): Promise<VoteRow | null> {
    const [vote] = await db
      .select()
      .from(reviewVotes)
      .where(
        and(
          eq(reviewVotes.reviewId, reviewId),
          eq(reviewVotes.anonymousId, anonymousId as any),
        ),
      );
    return vote ?? null;
  }

  async getVoteCounts(reviewId: number): Promise<{ helpful: number; unhelpful: number }> {
    const allVotes = await db
      .select()
      .from(reviewVotes)
      .where(eq(reviewVotes.reviewId, reviewId));

    const helpful = allVotes.filter((v) => v.voteType === 'helpful').length;
    const unhelpful = allVotes.filter((v) => v.voteType === 'unhelpful').length;

    return { helpful, unhelpful };
  }
}

export const votesRepository = new VotesRepository();
