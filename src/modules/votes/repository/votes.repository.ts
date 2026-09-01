import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db, type DatabaseTx } from '../../../database/db.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reviews } from '../../../database/schema/review.js';
import { companies } from '../../../database/schema/company.js';

type DbClient = typeof db | DatabaseTx;

interface VoteRow {
  id: number;
  reviewId: number;
  anonymousId: string;
  voteType: string;
  createdAt: Date;
}

interface VoteActivityRow {
  reviewPublicId: string | null;
  reviewTitle: string | null;
  companyName: string | null;
  voteType: string;
  createdAt: Date;
}

export class VotesRepository {
  async upsert(input: {
    reviewId: number;
    anonymousId: string;
    voteType: 'helpful' | 'unhelpful';
  }): Promise<VoteRow> {
    return this.upsertWithClient(db, input);
  }

  async upsertWithClient(client: DbClient, input: {
    reviewId: number;
    anonymousId: string;
    voteType: 'helpful' | 'unhelpful';
  }): Promise<VoteRow> {
    const [vote] = await client
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

  /** All votes cast by an identity, newest first, with target review info. */
  async findByAnonymousId(
    anonymousId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: VoteActivityRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select({
        reviewPublicId: reviews.publicId,
        reviewTitle: reviews.title,
        companyName: companies.name,
        voteType: reviewVotes.voteType,
        createdAt: reviewVotes.createdAt,
      })
      .from(reviewVotes)
      .leftJoin(reviews, eq(reviewVotes.reviewId, reviews.id))
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviewVotes.anonymousId, anonymousId))
      .orderBy(desc(reviewVotes.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reviewVotes)
      .where(eq(reviewVotes.anonymousId, anonymousId));

    return { data, total: totalResult?.total ?? 0 };
  }

  async getVoteCounts(reviewId: number): Promise<{ helpful: number; unhelpful: number }> {
    return this.getVoteCountsWithClient(db, reviewId);
  }

  async getVoteCountsWithClient(client: DbClient, reviewId: number): Promise<{ helpful: number; unhelpful: number }> {
    const [result] = await client
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
