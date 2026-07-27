import { nanoid } from 'nanoid';
import { anonymousRepository } from '../repository/anonymous.repository.js';
import { ANONYMOUS_ID_LENGTH } from '../../../shared/constants/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { AnonymousIdentity } from '../../../shared/types/index.js';
import type { CreateAnonymousResult } from '../types/anonymous.types.js';

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const lastSeenCache = new Map<string, number>();

class AnonymousService {
  async create(): Promise<CreateAnonymousResult> {
    const publicId = nanoid(ANONYMOUS_ID_LENGTH);
    return anonymousRepository.create({ publicId });
  }

  async findByPublicId(publicId: string): Promise<AnonymousIdentity | null> {
    if (!publicId) return null;
    return anonymousRepository.findByPublicId(publicId);
  }

  async findById(id: string): Promise<AnonymousIdentity | null> {
    return anonymousRepository.findById(id);
  }

  async updateLastSeen(id: string): Promise<void> {
    const now = Date.now();
    const lastUpdate = lastSeenCache.get(id);
    if (lastUpdate && now - lastUpdate < LAST_SEEN_THROTTLE_MS) return;
    lastSeenCache.set(id, now);
    await anonymousRepository.updateLastSeen(id);
  }

  async getCurrentIdentity(publicId: string): Promise<AnonymousIdentity> {
    const identity = await this.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Anonymous identity not found', 404);
    }
    return identity;
  }

  async list(params: { page: number; limit: number; status?: string }) {
    return anonymousRepository.findAll(params);
  }

  async block(publicId: string): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    if (identity.isBlocked) {
      throw new AppError('Identity is already blocked', 409);
    }
    return anonymousRepository.setBlocked(identity.id, true);
  }

  async unblock(publicId: string): Promise<AnonymousIdentity> {
    const identity = await anonymousRepository.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Identity not found', 404);
    }
    if (!identity.isBlocked) {
      throw new AppError('Identity is not blocked', 409);
    }
    return anonymousRepository.setBlocked(identity.id, false);
  }
}

export const anonymousService = new AnonymousService();
