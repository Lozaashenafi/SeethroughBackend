import { notificationsRepository } from '../repository/notifications.repository.js';

class NotificationsService {
  async create(input: {
    userId: string;
    type: 'comment' | 'like';
    reviewPublicId: string;
    message: string;
  }) {
    return notificationsRepository.create(input);
  }

  async list(userId: string, page: number, limit: number) {
    return notificationsRepository.findByUserId(userId, { page, limit });
  }

  async unreadCount(userId: string) {
    return notificationsRepository.countUnread(userId);
  }

  async markAsRead(id: number, userId: string) {
    return notificationsRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationsRepository.markAllAsRead(userId);
  }
}

export const notificationsService = new NotificationsService();
