import { eq, desc, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../../database/db.js';
import { comments } from '../../../database/schema/comment.js';

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
        anonymousId: input.anonymousId as any,
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
