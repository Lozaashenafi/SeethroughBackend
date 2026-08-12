import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { anonymousService } from '../service/anonymous.service.js';
import { toAnonymousResponse } from '../types/anonymous.types.js';

class AnonymousController {
  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    sendSuccess(res, toAnonymousResponse(req.anonymous!), 'Anonymous identity retrieved');
  }

  async updateNickname(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const nickname = (req.body as { nickname?: string } | undefined)?.nickname;
    const identity = await anonymousService.changeNickname(req.anonymous!.publicId, nickname);
    sendSuccess(
      res,
      toAnonymousResponse(identity),
      nickname ? 'Nickname updated' : 'Nickname generated',
    );
  }

  async getMyReviews(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await anonymousService.getOwnReviews(req.anonymous!.publicId, { page, limit });
    sendSuccess(res, result, 'My reviews retrieved');
  }

  async getMyReview(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const review = await anonymousService.getOwnReview(publicId, req.anonymous!.publicId);
    if (!review) {
      throw new AppError('Review not found', 404);
    }
    sendSuccess(res, review, 'My review retrieved');
  }

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await anonymousService.list({ page, limit, status, search });
    sendSuccess(
      res,
      {
        identities: result.data.map(toAnonymousResponse),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'Identities retrieved',
    );
  }

  async block(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const identity = await anonymousService.block(publicId);
    sendSuccess(res, toAnonymousResponse(identity), 'User blocked');
  }

  async unblock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const identity = await anonymousService.unblock(publicId);
    sendSuccess(res, toAnonymousResponse(identity), 'User unblocked');
  }

  async tempBlock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const hours = Math.max(1, Number(req.body?.hours) || 24);
    const identity = await anonymousService.tempBlock(publicId, hours * 60 * 60 * 1000);
    sendSuccess(res, toAnonymousResponse(identity), `User temporarily blocked for ${hours} hour(s)`);
  }

  async clearTempBlock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const identity = await anonymousService.clearTempBlock(publicId);
    sendSuccess(res, toAnonymousResponse(identity), 'Temporary block lifted');
  }

  async getActivity(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);

    const activity = await anonymousService.getActivity(publicId, { page, limit });
    sendSuccess(res, activity, 'Identity activity retrieved');
  }

  async getReviews(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const reviews = await anonymousService.getAllReviews(publicId);
    sendSuccess(res, { reviews }, 'Identity reviews retrieved');
  }

  async deleteIdentity(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    await anonymousService.deleteIdentity(publicId);
    sendSuccess(res, null, 'Identity and all associated content deleted');
  }
}

export const anonymousController = new AnonymousController();
