import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { userAuthRepository } from '../repository/userAuth.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { env } from '../../../config/env.js';
import { tokenBlocklist } from '../../../shared/utils/tokenBlocklist.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../../services/email.service.js';
import type { UserJwtPayload, UserProfile } from '../types/userAuth.types.js';

// Dummy hash for timing-safe comparison when email is unknown.
const DUMMY_PASSWORD_HASH = '$2b$10$QNTaq1ejo3M.YILwyMnAt.1V/DahPFee4NgPIOSZTOaUuW7vZLyyK';

const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

class UserAuthService {
  /**
   * Register a new user with email and password.
   * Returns the user profile and a JWT token.
   */
  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ token: string; user: UserProfile }> {
    // Check if email is already taken
    const existing = await userAuthRepository.findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    const user = await userAuthRepository.create({
      email,
      passwordHash,
      displayName,
      verificationToken,
      verificationExpiresAt,
    });

    const token = this.generateToken(user.id, user.email, user.displayName, user.role);

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(email, verificationToken, displayName).catch((err) => {
      console.error('Failed to send verification email:', err);
    });

    return { token, user };
  }

  /**
   * Login with email and password.
   */
  async login(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const user = await userAuthRepository.findByEmail(email);

    // Always compare to prevent timing-based user enumeration
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.passwordHash) {
      throw new AppError('This account uses Google Sign-In. Please log in with Google.', 400);
    }

    const token = this.generateToken(user.id, user.email, user.displayName, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
        hasPassword: true,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Sign in or register with Google OAuth.
   The `googleUser` is the verified payload from Google's ID token.
   */
  async googleSignIn(googleUser: {
    sub: string;
    email: string;
    name: string;
    email_verified: boolean;
  }): Promise<{ token: string; user: UserProfile }> {
    // Check if user already exists by Google ID
    let user = await userAuthRepository.findByGoogleId(googleUser.sub);

    if (user) {
      // Existing Google user — log them in
      const token = this.generateToken(user.id, user.email, user.displayName, user.role);
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          emailVerified: user.emailVerified,
          hasPassword: !!user.passwordHash,
          createdAt: user.createdAt,
        },
      };
    }

    // Check if an account with this email already exists (e.g. email/password signup)
    const existingByEmail = await userAuthRepository.findByEmail(googleUser.email);

    if (existingByEmail) {
      // Link Google ID to the existing email/password account.
      // The user proved ownership via Google, so we trust the linkage.
      if (!existingByEmail.googleId) {
        await userAuthRepository.linkGoogleAccount(existingByEmail.id, googleUser.sub);
      }
      // Also ensure email is marked as verified if Google says it is
      if (googleUser.email_verified && !existingByEmail.emailVerified) {
        await userAuthRepository.verifyEmail(existingByEmail.id);
      }

      const token = this.generateToken(
        existingByEmail.id,
        existingByEmail.email,
        existingByEmail.displayName,
        existingByEmail.role,
      );
      return {
        token,
        user: {
          id: existingByEmail.id,
          email: existingByEmail.email,
          displayName: existingByEmail.displayName,
          role: existingByEmail.role,
          emailVerified: true,
          hasPassword: !!existingByEmail.passwordHash,
          createdAt: existingByEmail.createdAt,
        },
      };
    }

    // No existing account — create a new user via Google
    const newUser = await userAuthRepository.create({
      email: googleUser.email,
      displayName: googleUser.name,
      googleId: googleUser.sub,
      emailVerified: googleUser.email_verified,
    });

    const token = this.generateToken(newUser.id, newUser.email, newUser.displayName, newUser.role);

    return { token, user: newUser };
  }

  /**
   * Verify email with the verification token.
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await userAuthRepository.findByVerificationToken(token);
    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }
    await userAuthRepository.verifyEmail(user.id);
  }

  /**
   * Resend a verification email. Generates a new token.
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    console.log('[VERIFY] Starting resend', { userId });
    const user = await userAuthRepository.getProfile(userId);
    console.log('[VERIFY] User lookup completed', {
      found: !!user,
      email: user?.email,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    console.log('[VERIFY] Token generated');

    await userAuthRepository.setVerificationToken(userId, verificationToken, verificationExpiresAt);

    console.log('[VERIFY] Verification token saved to DB');

    console.log('[VERIFY] Sending email...');

    await sendVerificationEmail(user.email, verificationToken, user.displayName);
    console.log('[VERIFY] Email send completed successfully');
  }

  /**
   * Send a password reset email (generates token).
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await userAuthRepository.findByEmail(email);
    if (!user) {
      // Don't reveal whether the email exists
      return;
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await userAuthRepository.setResetToken(user.id, resetToken, resetExpiresAt);

    // Send reset email (non-blocking — don't fail if email fails)
    sendPasswordResetEmail(email, resetToken, 'SeeThrough User').catch((err) => {
      console.error('Failed to send password reset email:', err);
    });
  }

  /**
   * Reset password with the reset token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await userAuthRepository.findByResetToken(token);
    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userAuthRepository.updatePassword(user.id, passwordHash);
  }

  /**
   * Verify and decode a JWT token.
   */
  verifyToken(token: string): UserJwtPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as UserJwtPayload;

      if (payload.jti && tokenBlocklist.isRevoked(payload.jti)) {
        throw new AppError('Token has been revoked', 401);
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired token', 401);
    }
  }

  /**
   * Revoke a token (logout).
   */
  revokeToken(payload: UserJwtPayload): void {
    const expiresAtMs = Date.now() + USER_SESSION_TTL_MS;
    tokenBlocklist.revoke(payload.jti, expiresAtMs);
  }

  /**
   * Get a user's profile by ID.
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await userAuthRepository.getProfile(userId);
    if (!profile) {
      throw new AppError('User not found', 404);
    }
    return profile;
  }

  /**
   * Update the user's display name.
   */
  async updateDisplayName(userId: string, displayName: string): Promise<UserProfile> {
    await userAuthRepository.updateDisplayName(userId, displayName);
    return this.getProfile(userId);
  }

  /**
   * Change password for users who have a password (email/password accounts).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await userAuthRepository.getFullUser(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (!user.passwordHash) {
      throw new AppError(
        'Your account uses Google Sign-In. Use "Set Password" to add a password.',
        400,
      );
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 401);
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userAuthRepository.updatePassword(userId, passwordHash);
  }

  /**
   * Set a password for Google-only users (who have no password yet).
   */
  async setPassword(userId: string, newPassword: string): Promise<void> {
    const user = await userAuthRepository.getFullUser(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.passwordHash) {
      throw new AppError('You already have a password. Use "Change Password" instead.', 400);
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userAuthRepository.updatePassword(userId, passwordHash);
  }

  private generateToken(userId: string, email: string, displayName: string, role: string): string {
    const jti = randomBytes(16).toString('hex');
    const payload: UserJwtPayload = {
      jti,
      userId,
      email,
      displayName,
      role,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: Math.floor(USER_SESSION_TTL_MS / 1000),
    });
  }
}

export const userAuthService = new UserAuthService();
