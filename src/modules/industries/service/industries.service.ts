import { industriesRepository } from '../repository/industries.repository.js';

class IndustriesService {
  async listAll(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return industriesRepository.findAll();
  }
}

export const industriesService = new IndustriesService();
