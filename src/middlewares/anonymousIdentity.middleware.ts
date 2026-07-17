import { Request, Response, NextFunction } from 'express';
import { anonymousService } from '../modules/anonymous/service/anonymous.service.js';
import { cookieConfig } from '../config/cookies.js';
import { logger } from '../config/logger.js';
import { ANONYMOUS_COOKIE_NAME } from '../shared/constants/index.js';
import { AnonymousIdentity } from '../shared/types/index.js';

declare global {
  namespace Express {
    interface Request {
      anonymous?: AnonymousIdentity;
    }
  }
}

export function anonymousIdentity() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const existingPublicId: string | undefined = req.cookies?.[ANONYMOUS_COOKIE_NAME];

      if (existingPublicId) {
        const identity = await anonymousService.findByPublicId(existingPublicId);

        if (identity) {
          req.anonymous = identity;
          await anonymousService.updateLastSeen(identity.id);
          res.cookie(ANONYMOUS_COOKIE_NAME, identity.publicId, cookieConfig);
          return next();
        }
      }

      const identity = await anonymousService.create();
      req.anonymous = identity;
      res.cookie(ANONYMOUS_COOKIE_NAME, identity.publicId, cookieConfig);
      logger.info({ publicId: identity.publicId }, 'New anonymous identity created');
      next();
    } catch (error) {
      next(error);
    }
  };
}
