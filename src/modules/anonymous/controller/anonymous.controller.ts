import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { toAnonymousResponse } from '../types/anonymous.types.js';

class AnonymousController {
  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    sendSuccess(res, toAnonymousResponse(req.anonymous!), 'Anonymous identity retrieved');
  }
}

export const anonymousController = new AnonymousController();
