import { db } from '../../../database/db.js';
import { tags } from '../../../database/schema/tag.js';

export class TagsRepository {
  async findAll(): Promise<Array<{ id: number; name: string; slug: string; createdAt: Date }>> {
    return db.select().from(tags).orderBy(tags.name);
  }
}

export const tagsRepository = new TagsRepository();
