import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { adminUsersService } from '../service/adminUsers.service.js';

class AdminUsersController {
  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { search, role, status, page, limit } = req.query as Record<
      string,
      string | undefined
    >;

    const result = await adminUsersService.list({
      search: search || undefined,
      role: (role as 'user' | 'admin' | 'all') || 'all',
      status: (status as 'active' | 'blocked' | 'restricted' | 'all') || 'all',
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    sendSuccess(res, result, 'Users retrieved');
  }

  async getById(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const user = await adminUsersService.getById(userId);
    sendSuccess(res, user, 'User retrieved');
  }

  async getActivity(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const activity = await adminUsersService.getActivity(userId, { page, limit });
    sendSuccess(res, activity, 'User activity retrieved');
  }

  async getAllReviews(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const reviews = await adminUsersService.getAllReviews(userId);
    sendSuccess(res, { reviews }, 'User reviews retrieved');
  }

  async block(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const user = await adminUsersService.block(userId, req.user!.userId);
    sendSuccess(res, user, 'User blocked');
  }

  async unblock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const user = await adminUsersService.unblock(userId, req.user!.userId);
    sendSuccess(res, user, 'User unblocked');
  }

  async tempBlock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const { hours } = req.body as { hours?: number };
    const user = await adminUsersService.tempBlock(
      userId,
      Number(hours) || 24,
      req.user!.userId,
    );
    sendSuccess(res, user, 'User temporarily restricted');
  }

  async clearTempBlock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    const user = await adminUsersService.clearTempBlock(userId, req.user!.userId);
    sendSuccess(res, user, 'Restriction lifted');
  }

  async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { userId } = req.params;
    await adminUsersService.delete(userId, req.user!.userId);
    sendSuccess(res, null, 'User deleted');
  }
}

export const adminUsersController = new AdminUsersController();
