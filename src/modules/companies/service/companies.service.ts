import { companiesRepository } from '../repository/companies.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';

interface ListCompaniesParams {
  search?: string;
  industry?: string;
  country?: string;
  city?: string;
  page: number;
  limit: number;
}

class CompaniesService {
  async list(params: ListCompaniesParams) {
    return companiesRepository.findAll(params);
  }

  async getBySlug(slug: string) {
    const company = await companiesRepository.findBySlug(slug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    return company;
  }

  async create(input: {
    name: string;
    slug: string;
    industryId: string;
    website?: string;
    country?: string;
    city?: string;
    description?: string;
  }) {
    // Check if slug is taken
    const existing = await companiesRepository.findBySlug(input.slug);
    if (existing) {
      throw new AppError('A company with this slug already exists', 409);
    }
    return companiesRepository.create(input);
  }

  async update(slug: string, input: Partial<{
    name: string;
    website: string | null;
    country: string | null;
    city: string | null;
    description: string | null;
    verified: boolean;
  }>) {
    const company = await companiesRepository.findBySlug(slug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    const updated = await companiesRepository.update(slug, input);
    if (!updated) {
      throw new AppError('Failed to update company', 500);
    }
    return updated;
  }

  async delete(slug: string) {
    const company = await companiesRepository.findBySlug(slug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    const deleted = await companiesRepository.delete(slug);
    if (!deleted) {
      throw new AppError('Failed to delete company', 500);
    }
  }
}

export const companiesService = new CompaniesService();
