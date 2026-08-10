import { nanoid } from 'nanoid';
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { reports } from '../../../database/schema/report.js';
import { reviews } from '../../../database/schema/review.js';
import { comments } from '../../../database/schema/comment.js';
import type { ReportStatus } from '../types/reports.types.js';

interface ReportRow {
  id: number;
  publicId: string;
  anonymousId: string;
  reviewId: number | null;
  commentId: number | null;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

interface ReportActivityRow {
  publicId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reviewPublicId: string | null;
  reviewTitle: string | null;
  commentPublicId: string | null;
  commentContent: string | null;
}

export class ReportsRepository {
  async create(input: {
    anonymousId: string;
    reviewId?: number;
    commentId?: number;
    reason: string;
    description?: string;
  }): Promise<ReportRow> {
    const publicId = nanoid(16);

    const [report] = await db
      .insert(reports)
      .values({
        publicId,
        anonymousId: input.anonymousId,
        reviewId: input.reviewId ?? null,
        commentId: input.commentId ?? null,
        reason: input.reason,
        description: input.description ?? null,
      })
      .returning();

    return report;
  }

  async findAll(params: {
    status?: ReportStatus;
    page: number;
    limit: number;
  }): Promise<{ data: ReportRow[]; total: number }> {
    const conditions: SQL[] = [];

    if (params.status) {
      conditions.push(eq(reports.status, params.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reports)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  /** All reports filed by an identity, newest first, with target review/comment info. */
  async findByAnonymousId(
    anonymousId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: ReportActivityRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select({
        publicId: reports.publicId,
        reason: reports.reason,
        description: reports.description,
        status: reports.status,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        reviewPublicId: reviews.publicId,
        reviewTitle: reviews.title,
        commentPublicId: comments.publicId,
        commentContent: comments.content,
      })
      .from(reports)
      .leftJoin(reviews, eq(reports.reviewId, reviews.id))
      .leftJoin(comments, eq(reports.commentId, comments.id))
      .where(eq(reports.anonymousId, anonymousId))
      .orderBy(desc(reports.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(reports)
      .where(eq(reports.anonymousId, anonymousId));

    return { data, total: totalResult?.total ?? 0 };
  }

  async findByPublicId(publicId: string): Promise<ReportRow | null> {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.publicId, publicId));
    return report ?? null;
  }

  async updateStatus(id: number, status: 'resolved' | 'dismissed'): Promise<ReportRow> {
    const [report] = await db
      .update(reports)
      .set({
        status,
        resolvedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    return report;
  }
}

export const reportsRepository = new ReportsRepository();
