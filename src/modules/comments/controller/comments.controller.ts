import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { commentsService } from '../service/comments.service.js';
import { toCommentResponse } from '../types/comments.types.js';

class CommentsController {
  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const comment = await commentsService.create({
      ...req.body,
      anonymousId: req.anonymous!.id,
    });
    sendSuccess(res, toCommentResponse(comment), 'Comment created', 201);
  }

  async listByReview(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { reviewPublicId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await commentsService.listByReview(reviewPublicId, page, limit);
    sendSuccess(
      res,
      {
        comments: result.data.map(toCommentResponse),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'Comments retrieved',
    );
  }
}

export const commentsController = new CommentsController();
