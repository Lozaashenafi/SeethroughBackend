import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';

/**
 * Rejects content-submission requests from identities under a temporary
 * spam/abuse block. Read-only requests are intentionally allowed — a
 * temporarily blocked reviewer can still browse.
 */
export function temporarilyBlockedGuard() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const identity = req.anonymous;
    if (!identity) {
      next(new AppError('Anonymous identity required', 401));
      return;
    }

    const blockedUntil = identity.tempBlockedUntil;
    if (blockedUntil && blockedUntil.getTime() > Date.now()) {
      const mins = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
      next(
        new AppError(
          `You have been temporarily restricted from posting. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`,
          429,
        ),
      );
      return;
    }

    next();
  };
}
