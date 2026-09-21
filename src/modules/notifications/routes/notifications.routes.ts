import { Router } from 'express';
import { notificationsController } from '../controller/notifications.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';

const notificationsRoutes = Router();

notificationsRoutes.get(
  '/',
  userAuth({ required: true }),
  asyncHandler(notificationsController.list.bind(notificationsController)),
);

notificationsRoutes.get(
  '/unread-count',
  userAuth({ required: true }),
  asyncHandler(notificationsController.unreadCount.bind(notificationsController)),
);

notificationsRoutes.patch(
  '/:id/read',
  userAuth({ required: true }),
  asyncHandler(notificationsController.markAsRead.bind(notificationsController)),
);

notificationsRoutes.patch(
  '/read-all',
  userAuth({ required: true }),
  asyncHandler(notificationsController.markAllAsRead.bind(notificationsController)),
);

export { notificationsRoutes };
