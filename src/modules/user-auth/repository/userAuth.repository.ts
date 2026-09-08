import { eq, or, isNull, and, gt } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { users } from '../../../database/schema/user.js';
import type { UserProfile } from '../types/userAuth.types.js';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  googleId: string | null;
  emailVerified: boolean;
  showDisplayName: boolean;
  verificationToken: string | null;
  verificationExpiresAt: Date | null;
  resetToken: string | null;
  resetExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserAuthRepository {
  async create(input: {
    email: string;
    passwordHash?: string;
    displayName: string;
    googleId?: string;
    emailVerified?: boolean;
    verificationToken?: string;
    verificationExpiresAt?: Date;
  }): Promise<UserProfile> {
    const [user] = await db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash ?? null,
        displayName: input.displayName,
        googleId: input.googleId ?? null,
        emailVerified: input.emailVerified ?? false,
        verificationToken: input.verificationToken ?? null,
        verificationExpiresAt: input.verificationExpiresAt ?? null,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        showDisplayName: users.showDisplayName,
        createdAt: users.createdAt,
      });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      showDisplayName: user.showDisplayName,
      hasPassword: !!input.passwordHash,
      createdAt: user.createdAt,
    };
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  }

  async findByGoogleId(googleId: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return user ?? null;
  }

  async findByVerificationToken(token: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.verificationToken, token),
          or(
            isNull(users.verificationExpiresAt),
            gt(users.verificationExpiresAt, new Date()),
          ),
        ),
      );
    return user ?? null;
  }

  async findByResetToken(token: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, token),
          or(
            isNull(users.resetExpiresAt),
            gt(users.resetExpiresAt, new Date()),
          ),
        ),
      );
    return user ?? null;
  }

  async verifyEmail(id: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async setVerificationToken(
    id: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        verificationToken: token,
        verificationExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async setResetToken(
    id: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        resetToken: token,
        resetExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async getProfile(id: string): Promise<UserProfile | null> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        showDisplayName: users.showDisplayName,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      showDisplayName: user.showDisplayName,
      hasPassword: !!user.passwordHash,
      createdAt: user.createdAt,
    };
  }

  async getFullUser(id: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  }

  async updateDisplayName(id: string, displayName: string): Promise<void> {
    await db
      .update(users)
      .set({
        displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async updateShowDisplayName(
    id: string,
    showDisplayName: boolean,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        showDisplayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Link a Google account to an existing email/password user.
   * Called when a Google sign-in matches an existing email but has no googleId.
   */
  async linkGoogleAccount(
    id: string,
    googleId: string,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        googleId,
        emailVerified: true, // Google already verified the email
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }
}

export const userAuthRepository = new UserAuthRepository();
