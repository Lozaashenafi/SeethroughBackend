import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { anonymousService } from '../modules/anonymous/service/anonymous.service.js';
import { cookieConfig } from '../config/cookies.js';
import { logger } from '../config/logger.js';
import { AppError } from '../shared/errors/AppError.js';
import { ANONYMOUS_COOKIE_NAME, ANONYMOUS_SESSION_COOKIE_NAME } from '../shared/constants/index.js';
import type { AnonymousIdentity } from '../shared/types/index.js';

declare global {
  namespace Express {
    interface Request {
      anonymous?: AnonymousIdentity;
      // True when no valid identity cookie pair was presented and a fresh
      // identity was minted for this request. Rate limiting must not key on a
      // freshly-minted publicId, or an attacker could rotate fake
      // `anonymous_id` cookies to reset its per-identity budget on every call.
      isNewAnonymousIdentity?: boolean;
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
            // Session token is valid — normal happy path.
            if (identity.isBlocked) {
              logger.warn({ publicId: existingPublicId }, 'Blocked identity attempted access');
              next(new AppError('Your account has been blocked. If you believe this is a mistake, please contact support.', 403));
              return;
            }

            const enriched = await anonymousService.ensureNickname(identity);
            req.anonymous = enriched;
            await anonymousService.updateLastSeen(enriched.id);
            return next();
          }

          // Session token mismatch — re-issue a fresh session token for the
          // same identity instead of minting a brand-new one. This prevents an
          // attacker from flooding the DB by rotating stale cookies, and keeps
          // the user's identity / data intact.
          logger.warn({ publicId: existingPublicId }, 'Session token mismatch — reissuing session');

          if (identity.isBlocked) {
            logger.warn({ publicId: existingPublicId }, 'Blocked identity attempted access (mismatch path)');
            next(new AppError('Your account has been blocked. If you believe this is a mistake, please contact support.', 403));
            return;
          }

          const newSessionToken = await anonymousService.reissueSessionToken(identity.id);
          const enriched = await anonymousService.ensureNickname(identity);
          req.anonymous = enriched;
          await anonymousService.updateLastSeen(enriched.id);
          res.cookie(ANONYMOUS_SESSION_COOKIE_NAME, newSessionToken, {
            ...cookieConfig,
            httpOnly: true,
          });
          return next();
        }

        // publicId exists in the cookie but the identity was deleted (e.g. by
        // an admin). Fall through to mint a fresh identity below.
      }

      // No cookies, or orphaned publicId — mint a brand-new identity.
      const { identity, rawSessionToken } = await anonymousService.create();
      req.anonymous = identity;
      req.isNewAnonymousIdentity = true;
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
