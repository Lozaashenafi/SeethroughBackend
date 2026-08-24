import { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { uploadsService } from '../service/uploads.service.js';

class UploadsController {
  async uploadLogo(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      throw new AppError('No file provided. Send multipart/form-data with a "file" field.', 400);
    }

    const result = await uploadsService.uploadLogo(file);

    sendSuccess(
      res,
      {
        url: result.url,
        pathname: result.pathname,
        size: result.size,
      },
      'Logo uploaded',
      201,
    );
  }
}

export const uploadsController = new UploadsController();
