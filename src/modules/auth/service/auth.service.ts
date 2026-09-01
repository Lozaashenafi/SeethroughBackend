import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { authRepository } from '../repository/auth.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { env } from '../../../config/env.js';
import { ADMIN_SESSION_TTL_MS } from '../../../shared/constants/index.js';
import { tokenBlocklist } from '../../../shared/utils/tokenBlocklist.js';
import type { AdminJwtPayload } from '../types/auth.types.js';

// A valid bcrypt hash of a random value. When the email is unknown we compare
// against this so both unknown-email and wrong-password cases take the same
// amount of time, preventing user-enumeration via response timing.
const DUMMY_PASSWORD_HASH =
  '$2b$10$QNTaq1ejo3M.YILwyMnAt.1V/DahPFee4NgPIOSZTOaUuW7vZLyyK';

class AuthService {
  async login(email: string, password: string): Promise<{ token: string; admin: { id: number; email: string; name: string } }> {
    const admin = await authRepository.findByEmail(email);

    // Always run the comparison, against the real hash when the admin exists or
    // a dummy hash otherwise, so timing does not reveal whether the email is valid.
    const passwordHash = admin?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordHash);

    if (!admin || !isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const jti = randomBytes(16).toString('hex');
    const payload: AdminJwtPayload = {
      jti,
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    };
  }

  verifyToken(token: string): AdminJwtPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;

      if (payload.jti && tokenBlocklist.isRevoked(payload.jti)) {
        throw new AppError('Token has been revoked', 401);
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired token', 401);
    }
  }
}

export const authService = new AuthService();
