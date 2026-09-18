import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { notificationsService } from '../service/notifications.service.js';

class NotificationsController {
  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await notificationsService.list(req.user!.userId, page, limit);
    sendSuccess(
      res,
      {
        notifications: result.data,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'Notifications retrieved',
    );
  }

  async unreadCount(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const total = await notificationsService.unreadCount(req.user!.userId);
    sendSuccess(res, { total }, 'Unread count retrieved');
  }

  async markAsRead(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = Number(req.params.id);
    await notificationsService.markAsRead(id, req.user!.userId);
    sendSuccess(res, null, 'Notification marked as read');
  }

  async markAllAsRead(req: Request, res: Response, _next: NextFunction): Promise<void> {
    await notificationsService.markAllAsRead(req.user!.userId);
    sendSuccess(res, null, 'All notifications marked as read');
  }
}

export const notificationsController = new NotificationsController();
