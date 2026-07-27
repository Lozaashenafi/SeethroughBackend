import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { authService } from '../service/auth.service.js';
import { toLoginResponse } from '../types/auth.types.js';

class AuthController {
  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    sendSuccess(res, toLoginResponse(result.admin, result.token), 'Login successful');
  }

  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const admin = req.admin!;
    sendSuccess(res, { id: admin.adminId, email: admin.email, name: admin.name }, 'Admin profile');
  }
}

export const authController = new AuthController();
