import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { tagsService } from '../service/tags.service.js';
import { toTagResponse } from '../types/tags.types.js';

class TagsController {
  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    const tags = await tagsService.listAll();
    sendSuccess(res, tags.map(toTagResponse), 'Tags retrieved');
  }
}

export const tagsController = new TagsController();
