import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { anonymousService } from '../modules/anonymous/service/anonymous.service.js';
import { cookieConfig } from '../config/cookies.js';
import { logger } from '../config/logger.js';
import { ANONYMOUS_COOKIE_NAME, ANONYMOUS_SESSION_COOKIE_NAME } from '../shared/constants/index.js';
import type { AnonymousIdentity } from '../shared/types/index.js';

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
      const sessionToken: string | undefined = req.cookies?.[ANONYMOUS_SESSION_COOKIE_NAME];

      if (existingPublicId && sessionToken) {
        const identity = await anonymousService.findByPublicId(existingPublicId);

        if (identity) {
          const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

          if (tokenHash === identity.sessionTokenHash) {
            if (identity.isBlocked) {
              logger.warn({ publicId: existingPublicId }, 'Blocked identity attempted access');
            }
            req.anonymous = identity;
            await anonymousService.updateLastSeen(identity.id);
            return next();
          }

          logger.warn({ publicId: existingPublicId }, 'Session token mismatch — treating as new identity');
        }
      }

      const { identity, rawSessionToken } = await anonymousService.create();
      req.anonymous = identity;
      res.cookie(ANONYMOUS_COOKIE_NAME, identity.publicId, cookieConfig);
      res.cookie(ANONYMOUS_SESSION_COOKIE_NAME, rawSessionToken, {
        ...cookieConfig,
        httpOnly: true,
      });
      logger.info({ publicId: identity.publicId }, 'New anonymous identity created');
      next();
    } catch (error) {
      next(error);
    }
  };
}
