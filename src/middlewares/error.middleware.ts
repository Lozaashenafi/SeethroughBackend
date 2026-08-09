import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { sendError } from '../shared/responses/index.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// body-parser / http-errors style errors carry a `status`/`statusCode`/`type`.
interface HttpStatusError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string;
}

// PostgreSQL error codes we can safely map to a client error.
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

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

  const httpError = err as HttpStatusError;

  // Oversized request body — currently surfaces as a generic 500, confusing users.
  if (httpError.type === 'entity.too.large') {
    logger.warn({ statusCode: 413 }, 'Payload too large');
    sendError(res, 'Request body too large.', 413);
    return;
  }

  if (httpError.type === 'entity.parse.failed') {
    logger.warn({ statusCode: 400 }, 'Malformed JSON body');
    sendError(res, 'Malformed JSON in request body.', 400);
    return;
  }

  // Map well-known Postgres constraint violations to client errors instead of 500s.
  switch (httpError.code) {
    case PG_UNIQUE_VIOLATION:
      logger.warn({ message: err.message }, 'Unique constraint violation');
      sendError(res, 'A record with this value already exists.', 409);
      return;
    case PG_FOREIGN_KEY_VIOLATION:
      logger.warn({ message: err.message }, 'Foreign key violation');
      sendError(res, 'Referenced record does not exist.', 400);
      return;
    case PG_NOT_NULL_VIOLATION:
      logger.warn({ message: err.message }, 'Not-null violation');
      sendError(res, 'A required field is missing.', 400);
      return;
    case PG_INVALID_TEXT_REPRESENTATION:
      logger.warn({ message: err.message }, 'Invalid value representation');
      sendError(res, 'Invalid value provided.', 400);
      return;
  }

  // Honor a well-formed 4xx status from other middleware (body-parser, etc.).
  const clientStatus =
    typeof httpError.statusCode === 'number' ? httpError.statusCode : httpError.status;
  if (typeof clientStatus === 'number' && clientStatus >= 400 && clientStatus < 500) {
    logger.warn({ statusCode: clientStatus, message: err.message }, 'Client error');
    sendError(res, 'Request could not be processed.', clientStatus);
    return;
  }

  logger.error({ err, message: err.message }, 'Unhandled error');

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, message, 500);
}
