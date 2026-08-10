import { eq, and, count, desc, type SQL } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '../../../database/db.js';
import { anonymousIdentities } from '../../../database/schema/anonymousIdentity.js';
import type { CreateAnonymousInput, CreateAnonymousResult } from '../types/anonymous.types.js';

import type { AnonymousIdentity } from '../../../shared/types/index.js';

type AnonymousRow = AnonymousIdentity & { sessionTokenHash: string };

export class AnonymousRepository {
  async create(input: CreateAnonymousInput): Promise<CreateAnonymousResult> {
    // 256-bit CSPRNG token — Math.random()/Date.now() are predictable and weak.
    const rawSessionToken = randomBytes(32).toString('base64url');

    const sessionTokenHash = createHash('sha256').update(rawSessionToken).digest('hex');

    const [identity] = await db
      .insert(anonymousIdentities)
      .values({
        publicId: input.publicId,
        sessionTokenHash,
        nickname: input.nickname,
      })
      .returning();

    return { identity, rawSessionToken };
  }

  async findByPublicId(publicId: string): Promise<AnonymousRow | null> {
    const [identity] = await db
      .select()
      .from(anonymousIdentities)
      .where(eq(anonymousIdentities.publicId, publicId));
    return identity ?? null;
  }

  async findById(id: string): Promise<AnonymousRow | null> {
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

  async findAll(params: { page: number; limit: number; status?: string }): Promise<{ data: AnonymousRow[]; total: number }> {
    const conditions: SQL[] = [];

    if (params.status && params.status !== 'all') {
      conditions.push(eq(anonymousIdentities.status, params.status as 'active' | 'disabled' | 'flagged'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select()
      .from(anonymousIdentities)
      .where(whereClause)
      .orderBy(desc(anonymousIdentities.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(anonymousIdentities)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  async setBlocked(id: string, isBlocked: boolean): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({
        isBlocked,
        status: isBlocked ? 'disabled' : 'active',
      })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  async updateNickname(id: string, nickname: string): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ nickname, nicknameRegeneratedAt: new Date() })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  async setTempBlocked(id: string, until: Date): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ tempBlockedUntil: until })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }

  async clearTempBlock(id: string): Promise<AnonymousRow> {
    const [identity] = await db
      .update(anonymousIdentities)
      .set({ tempBlockedUntil: null })
      .where(eq(anonymousIdentities.id, id))
      .returning();

    return identity;
  }
}

export const anonymousRepository = new AnonymousRepository();
