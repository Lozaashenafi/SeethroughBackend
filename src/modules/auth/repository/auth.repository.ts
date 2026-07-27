import { eq } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { admins } from '../../../database/schema/admin.js';

interface AdminRow {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthRepository {
  async findByEmail(email: string): Promise<AdminRow | null> {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email));
    return admin ?? null;
  }

  async findById(id: number): Promise<Omit<AdminRow, 'passwordHash'> | null> {
    const [admin] = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        createdAt: admins.createdAt,
        updatedAt: admins.updatedAt,
      })
      .from(admins)
      .where(eq(admins.id, id));
    return admin ?? null;
  }
}

export const authRepository = new AuthRepository();
