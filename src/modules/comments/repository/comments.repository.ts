import { eq, desc, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../../database/db.js';
import { comments } from '../../../database/schema/comment.js';
import { reviews } from '../../../database/schema/review.js';
import { companies } from '../../../database/schema/company.js';

interface CommentActivityRow {
  publicId: string;
  reviewPublicId: string | null;
  reviewTitle: string | null;
  companyName: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
}

interface CommentRow {
  id: number;
  publicId: string;
  anonymousId: string;
  reviewId: number;
  parentId: number | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CommentsRepository {
  async create(input: {
    anonymousId: string;
    reviewId: number;
    content: string;
    parentId?: number;
  }): Promise<CommentRow> {
    const publicId = nanoid(16);

    const [comment] = await db
      .insert(comments)
      .values({
        publicId,
        anonymousId: input.anonymousId,
        reviewId: input.reviewId,
        content: input.content,
        parentId: input.parentId ?? null,
      })
      .returning();

    return comment;
  }

  async findByReviewId(
    reviewId: number,
    params: { page: number; limit: number },
  ): Promise<{ data: CommentRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select()
      .from(comments)
      .where(eq(comments.reviewId, reviewId))
      .orderBy(desc(comments.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(comments)
      .where(eq(comments.reviewId, reviewId));

    return { data, total: totalResult?.total ?? 0 };
  }

  /** All comments authored by an identity, newest first, with target review info. */
  async findByAnonymousId(
    anonymousId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: CommentActivityRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select({
        publicId: comments.publicId,
        reviewPublicId: reviews.publicId,
        reviewTitle: reviews.title,
        companyName: companies.name,
        content: comments.content,
        helpfulCount: comments.helpfulCount,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .leftJoin(reviews, eq(comments.reviewId, reviews.id))
      .leftJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(comments.anonymousId, anonymousId))
      .orderBy(desc(comments.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(comments)
      .where(eq(comments.anonymousId, anonymousId));

    return { data, total: totalResult?.total ?? 0 };
  }

  async findById(id: number): Promise<CommentRow | null> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id));
    return comment ?? null;
  }

  async findByPublicId(publicId: string): Promise<CommentRow | null> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.publicId, publicId));
    return comment ?? null;
  }
}

export const commentsRepository = new CommentsRepository();
