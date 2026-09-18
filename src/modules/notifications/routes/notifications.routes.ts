import { Router } from 'express';
import { notificationsController } from '../controller/notifications.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';

const notificationsRoutes = Router();

notificationsRoutes.get(
  '/',
  userAuth(),
  asyncHandler(notificationsController.list.bind(notificationsController)),
);

notificationsRoutes.get(
  '/unread-count',
  userAuth(),
  asyncHandler(notificationsController.unreadCount.bind(notificationsController)),
);

notificationsRoutes.patch(
  '/:id/read',
  userAuth(),
  asyncHandler(notificationsController.markAsRead.bind(notificationsController)),
);

notificationsRoutes.patch(
  '/read-all',
  userAuth(),
  asyncHandler(notificationsController.markAllAsRead.bind(notificationsController)),
);

export { notificationsRoutes };
