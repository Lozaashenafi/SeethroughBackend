import { nanoid } from 'nanoid';
import { anonymousRepository } from '../repository/anonymous.repository.js';
import { ANONYMOUS_ID_LENGTH } from '../../../shared/constants/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { AnonymousIdentity } from '../../../shared/types/index.js';

class AnonymousService {
  async create(): Promise<AnonymousIdentity> {
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
    await anonymousRepository.updateLastSeen(id);
  }

  async getCurrentIdentity(publicId: string): Promise<AnonymousIdentity> {
    const identity = await this.findByPublicId(publicId);
    if (!identity) {
      throw new AppError('Anonymous identity not found', 404);
    }
    return identity;
  }
}

export const anonymousService = new AnonymousService();
