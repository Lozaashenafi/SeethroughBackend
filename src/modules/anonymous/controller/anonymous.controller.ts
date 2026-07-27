import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { anonymousService } from '../service/anonymous.service.js';
import { toAnonymousResponse } from '../types/anonymous.types.js';

class AnonymousController {
  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    sendSuccess(res, toAnonymousResponse(req.anonymous!), 'Anonymous identity retrieved');
  }

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
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
}

export const anonymousController = new AnonymousController();
