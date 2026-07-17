import { eq } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { anonymousIdentities } from '../../../database/schema/anonymousIdentity.js';
import type { CreateAnonymousInput } from '../types/anonymous.types.js';
import type { AnonymousIdentity } from '../../../shared/types/index.js';
import { createHash } from 'node:crypto';

export class AnonymousRepository {
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(input: CreateAnonymousInput): Promise<AnonymousIdentity> {
    const sessionTokenHash = this.hashToken(input.publicId);
    const [identity] = await db
      .insert(anonymousIdentities)
      .values({
        publicId: input.publicId,
        sessionTokenHash,
      })
      .returning();
    return identity;
  }

  async findByPublicId(publicId: string): Promise<AnonymousIdentity | null> {
    const [identity] = await db
      .select()
      .from(anonymousIdentities)
      .where(eq(anonymousIdentities.publicId, publicId));
    return identity ?? null;
  }

  async findById(id: string): Promise<AnonymousIdentity | null> {
    const [identity] = await db
      .select()
      .from(anonymousIdentities)
      .where(eq(anonymousIdentities.id, id));
    return identity ?? null;
  }

  async updateLastSeen(id: string): Promise<void> {
    await db
      .update(anonymousIdentities)
      .set({ lastSeenAt: new Date() })
      .where(eq(anonymousIdentities.id, id));
  }

  async markBlocked(id: string, isBlocked: boolean): Promise<void> {
    await db
      .update(anonymousIdentities)
      .set({ isBlocked })
      .where(eq(anonymousIdentities.id, id));
  }
}

export const anonymousRepository = new AnonymousRepository();
