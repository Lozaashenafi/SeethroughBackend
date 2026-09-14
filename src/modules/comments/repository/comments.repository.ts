import { eq, desc, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
  userId: string;
  reviewId: number;
  parentId: number | null;
  parentPublicId?: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CommentsRepository {
  async create(input: {
    userId: string;
    reviewId: number;
    content: string;
    parentId?: number;
    parentPublicId?: string;
  }): Promise<CommentRow> {
    const publicId = nanoid(16);

    const [comment] = await db
      .insert(comments)
      .values({
        publicId,
        userId: input.userId,
        reviewId: input.reviewId,
        content: input.content,
        parentId: input.parentId ?? null,
      })
      .returning();

    return {
      ...comment,
      parentPublicId: input.parentPublicId ?? null,
    };
  }

  async findByReviewId(
    reviewId: number,
    params: { page: number; limit: number },
  ): Promise<{ data: CommentRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    // Self-join on the parent comment so replies expose the parent's PUBLIC id
    // instead of the internal DB id.
    const parentComments = alias(comments, 'parent_comments');

    const data = await db
      .select({
        id: comments.id,
        publicId: comments.publicId,
        userId: comments.userId,
        reviewId: comments.reviewId,
        parentId: comments.parentId,
        parentPublicId: parentComments.publicId,
        content: comments.content,
        helpfulCount: comments.helpfulCount,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .leftJoin(parentComments, eq(comments.parentId, parentComments.id))
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

  /** All comments authored by a user, newest first, with target review info. */
  async findByUserId(
    userId: string,
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
      .where(eq(comments.userId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(comments)
      .where(eq(comments.userId, userId));

    return { data, total: totalResult?.total ?? 0 };
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
