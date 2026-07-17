import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { sendError } from '../shared/responses/index.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn({ statusCode: err.statusCode, message: err.message }, 'Operational error');
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  logger.error({ err, message: err.message }, 'Unhandled error');

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, message, 500);
}
