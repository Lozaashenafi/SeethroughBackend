import { eq, and, sql } from 'drizzle-orm';
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
    const [vote] = await db
      .insert(reviewVotes)
      .values({
        reviewId: input.reviewId,
        anonymousId: input.anonymousId,
        voteType: input.voteType,
      })
      .onConflictDoUpdate({
        target: [reviewVotes.reviewId, reviewVotes.anonymousId],
        set: {
          voteType: input.voteType,
          createdAt: new Date(),
        },
      })
      .returning();
    return vote;
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
          eq(reviewVotes.anonymousId, anonymousId),
        ),
      );
    return vote ?? null;
  }

  async getVoteCounts(reviewId: number): Promise<{ helpful: number; unhelpful: number }> {
    // Aggregate in SQL so we never pull every vote row into memory.
    const [result] = await db
      .select({
        helpful: sql<number>`count(*) FILTER (WHERE ${reviewVotes.voteType} = 'helpful')`,
        unhelpful: sql<number>`count(*) FILTER (WHERE ${reviewVotes.voteType} = 'unhelpful')`,
      })
      .from(reviewVotes)
      .where(eq(reviewVotes.reviewId, reviewId));

    return {
      helpful: result?.helpful ?? 0,
      unhelpful: result?.unhelpful ?? 0,
    };
  }
}

export const votesRepository = new VotesRepository();
