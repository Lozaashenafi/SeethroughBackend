import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRepository } from '../repository/auth.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { env } from '../../../config/env.js';
import type { AdminJwtPayload } from '../types/auth.types.js';

class AuthService {
  async login(email: string, password: string): Promise<{ token: string; admin: { id: number; email: string; name: string } }> {
    const admin = await authRepository.findByEmail(email);
    if (!admin) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const payload: AdminJwtPayload = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });

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
      return jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  }
}

export const authService = new AuthService();
