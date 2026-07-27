import { nanoid } from 'nanoid';
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { reports } from '../../../database/schema/report.js';

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
        anonymousId: input.anonymousId as any,
        reviewId: input.reviewId ?? null,
        commentId: input.commentId ?? null,
        reason: input.reason,
        description: input.description ?? null,
      })
      .returning();

    return report;
  }

  async findAll(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ data: ReportRow[]; total: number }> {
    const conditions: SQL[] = [];

    if (params.status) {
      conditions.push(eq(reports.status, params.status as any));
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
