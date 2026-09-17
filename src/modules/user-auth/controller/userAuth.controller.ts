import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { sendSuccess, sendError } from '../../../shared/responses/index.js';
import { userAuthService } from '../service/userAuth.service.js';
import { toUserProfile } from '../types/userAuth.types.js';
import { reviewsRepository } from '../../reviews/repository/reviews.repository.js';
import { toReviewResponse } from '../../reviews/types/reviews.types.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { env } from '../../../config/env.js';
import { USER_TOKEN_COOKIE } from '../../../shared/constants/index.js';

class UserAuthController {
  async register(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { email, password, displayName } = req.body;
    const result = await userAuthService.register(email, password, displayName);

    res.cookie(USER_TOKEN_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    sendSuccess(res, { user: result.user }, 'Account created successfully', 201);
  }

  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { email, password } = req.body;
    const result = await userAuthService.login(email, password);

    res.cookie(USER_TOKEN_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    sendSuccess(res, { user: result.user }, 'Logged in successfully');
  }

  async googleCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { idToken } = req.body;

    try {
      let sub: string;
      let email: string;
      let name: string;
      let emailVerified: boolean;

      if (env.GOOGLE_CLIENT_ID) {
        // Production: cryptographically verify the token with Google
        const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email) {
          sendError(res, 'Invalid Google token', 400);
          return;
        }
        sub = payload.sub;
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        emailVerified = payload.email_verified ?? false;
      } else {
        // Dev fallback: decode without verification (GOOGLE_CLIENT_ID not set)
        console.warn('⚠️  GOOGLE_CLIENT_ID not set — decoding Google token without verification. Do NOT use this in production.');
        const payload = JSON.parse(
          Buffer.from(idToken.split('.')[1], 'base64url').toString(),
        );
        if (!payload.sub || !payload.email) {
          sendError(res, 'Invalid Google token', 400);
          return;
        }
        sub = payload.sub;
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        emailVerified = payload.email_verified ?? false;
      }

      const result = await userAuthService.googleSignIn({
        sub,
        email,
        name,
        email_verified: emailVerified,
      });

      res.cookie(USER_TOKEN_COOKIE, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, { user: result.user }, 'Signed in with Google');
    } catch {
      sendError(res, 'Invalid or expired Google token', 400);
    }
  }

  async verifyEmail(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { token } = req.body;
    await userAuthService.verifyEmail(token);
    sendSuccess(res, null, 'Email verified successfully');
  }

  async resendVerification(req: Request, res: Response, _next: NextFunction): Promise<void> {
    await userAuthService.resendVerificationEmail(req.user!.userId);
    sendSuccess(res, null, 'Verification email sent');
  }

  async forgotPassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { email } = req.body;
    await userAuthService.forgotPassword(email);
    sendSuccess(res, null, 'If an account exists with this email, a reset link has been sent');
  }

  async resetPassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { token, password } = req.body;
    await userAuthService.resetPassword(token, password);
    sendSuccess(res, null, 'Password reset successfully');
  }

  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const profile = await userAuthService.getProfile(req.user!.userId);
    sendSuccess(res, toUserProfile(profile), 'Profile retrieved');
  }

  async updateDisplayName(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { displayName } = req.body;
    const profile = await userAuthService.updateDisplayName(
      req.user!.userId,
      displayName,
    );
    sendSuccess(res, toUserProfile(profile), 'Display name updated');
  }

  async changePassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { currentPassword, newPassword } = req.body;
    await userAuthService.changePassword(
      req.user!.userId,
      currentPassword,
      newPassword,
    );
    sendSuccess(res, null, 'Password changed successfully');
  }

  async setPassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { password } = req.body;
    await userAuthService.setPassword(req.user!.userId, password);
    sendSuccess(res, null, 'Password set successfully');
  }

  async getMyReviews(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await reviewsRepository.findByUserId(req.user!.userId, { page, limit });
    sendSuccess(
      res,
      {
        reviews: result.data.map(toReviewResponse),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'Your reviews retrieved',
    );
  }

  async getMyReview(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const review = await reviewsRepository.findByPublicId(publicId);
    if (!review || review.userId !== req.user!.userId) {
      throw new AppError('Review not found', 404);
    }
    sendSuccess(res, toReviewResponse(review), 'Review retrieved');
  }

  async logout(req: Request, res: Response, _next: NextFunction): Promise<void> {
    if (req.user) {
      userAuthService.revokeToken(req.user);
    }
    res.clearCookie(USER_TOKEN_COOKIE, { path: '/' });
    sendSuccess(res, null, 'Logged out successfully');
  }
}

export const userAuthController = new UserAuthController();
