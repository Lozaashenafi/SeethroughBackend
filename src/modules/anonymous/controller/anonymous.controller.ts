import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { anonymousService } from '../service/anonymous.service.js';
import { toAnonymousResponse } from '../types/anonymous.types.js';

class AnonymousController {
  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    sendSuccess(res, toAnonymousResponse(req.anonymous!), 'Anonymous identity retrieved');
  }

  async regenerateNickname(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const identity = await anonymousService.regenerateNickname(req.anonymous!.publicId);
    sendSuccess(res, toAnonymousResponse(identity), 'Nickname regenerated');
  }

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const status = req.query.status as string | undefined;

    const result = await anonymousService.list({ page, limit, status });
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
}

export const anonymousController = new AnonymousController();
