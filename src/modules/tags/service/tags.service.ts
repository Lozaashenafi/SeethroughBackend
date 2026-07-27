import { tagsRepository } from '../repository/tags.repository.js';

class TagsService {
  async listAll(): Promise<Array<{ id: number; name: string; slug: string; createdAt: Date }>> {
    return tagsRepository.findAll();
  }
}

export const tagsService = new TagsService();
