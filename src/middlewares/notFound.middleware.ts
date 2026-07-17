import { Request, Response } from 'express';
import { sendError } from '../shared/responses/index.js';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 'Resource not found', 404);
}
