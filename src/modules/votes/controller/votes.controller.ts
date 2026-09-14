import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { votesService } from '../service/votes.service.js';
import { toVoteResponse } from '../types/votes.types.js';

class VotesController {
  async vote(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const vote = await votesService.vote({
      ...req.body,
      userId: req.user!.userId,
    });
    sendSuccess(res, toVoteResponse(vote), 'Vote recorded');
  }
}

export const votesController = new VotesController();
