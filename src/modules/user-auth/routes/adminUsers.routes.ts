import { Router } from 'express';
import { adminUsersController } from '../controller/adminUsers.controller.js';
import { userAuth } from '../../../middlewares/userAuth.middleware.js';
import { createRateLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../../shared/utils/index.js';
import { RATE_LIMITS } from '../../../shared/constants/index.js';
import {
  adminUserActivityQuerySchema,
  adminUserParamsSchema,
  listAdminUsersQuerySchema,
  tempBlockUserSchema,
} from '../validation/adminUsers.validation.js';

const adminUsersRoutes = Router();

// Mounted at /user/admin/users — every route is admin-only.
adminUsersRoutes.use(userAuth({ adminOnly: true }));

adminUsersRoutes.get(
  '/',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ query: listAdminUsersQuerySchema }),
  asyncHandler(adminUsersController.list.bind(adminUsersController)),
);

adminUsersRoutes.get(
  '/:userId/activity',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: adminUserParamsSchema, query: adminUserActivityQuerySchema }),
  asyncHandler(adminUsersController.getActivity.bind(adminUsersController)),
);

adminUsersRoutes.get(
  '/:userId/reviews',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: adminUserParamsSchema }),
  asyncHandler(adminUsersController.getAllReviews.bind(adminUsersController)),
);

adminUsersRoutes.get(
  '/:userId',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: adminUserParamsSchema }),
  asyncHandler(adminUsersController.getById.bind(adminUsersController)),
);

adminUsersRoutes.patch(
  '/:userId/block',
  validate({ params: adminUserParamsSchema }),
  asyncHandler(adminUsersController.block.bind(adminUsersController)),
);

adminUsersRoutes.patch(
  '/:userId/unblock',
  validate({ params: adminUserParamsSchema }),
  asyncHandler(adminUsersController.unblock.bind(adminUsersController)),
);

adminUsersRoutes.patch(
  '/:userId/temp-block',
  validate({ params: adminUserParamsSchema, body: tempBlockUserSchema }),
  asyncHandler(adminUsersController.tempBlock.bind(adminUsersController)),
);

adminUsersRoutes.patch(
  '/:userId/clear-temp-block',
  validate({ params: adminUserParamsSchema }),
  asyncHandler(adminUsersController.clearTempBlock.bind(adminUsersController)),
);

adminUsersRoutes.delete(
  '/:userId',
  createRateLimiter(RATE_LIMITS.DEFAULT),
  validate({ params: adminUserParamsSchema }),
  asyncHandler(adminUsersController.remove.bind(adminUsersController)),
);

export { adminUsersRoutes };
