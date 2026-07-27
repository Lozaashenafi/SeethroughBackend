import { db } from '../../../database/db.js';
import { industries } from '../../../database/schema/industry.js';

export class IndustriesRepository {
  async findAll(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return db.select().from(industries).orderBy(industries.name);
  }
}

export const industriesRepository = new IndustriesRepository();
