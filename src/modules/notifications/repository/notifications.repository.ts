import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { notifications } from '../../../database/schema/notification.js';

export interface NotificationRow {
  id: number;
  userId: string;
  type: 'comment' | 'like';
  reviewPublicId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export class NotificationsRepository {
  async create(input: {
    userId: string;
    type: 'comment' | 'like';
    reviewPublicId: string;
    message: string;
  }): Promise<NotificationRow> {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        reviewPublicId: input.reviewPublicId,
        message: input.message,
      })
      .returning();
    return notification;
  }

  async findByUserId(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: NotificationRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));

    return { data, total: totalResult?.total ?? 0 };
  }

  async countUnread(userId: string): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result?.total ?? 0;
  }

  async markAsRead(id: number, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async markAllAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }
}

export const notificationsRepository = new NotificationsRepository();
