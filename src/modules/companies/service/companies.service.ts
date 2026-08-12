import { companiesRepository, type CompanyRow } from '../repository/companies.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';
import {
  normalizeHostname,
  isSameWebsiteHostname,
  companyNameSimilarity,
  NAME_SIMILARITY_THRESHOLD,
} from '../../../shared/utils/companyMatch.js';

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
    logoUrl?: string | null;
    country?: string;
    city?: string;
    description?: string;
  }) {
    // Check if slug is taken
    const existing = await companiesRepository.findBySlug(input.slug);
    if (existing) {
      throw new AppError('A company with this slug already exists', 409);
    }

    // Hard block: a company with the same website must never be created,
    // regardless of how the request is made.
    if (input.website) {
      const hostname = normalizeHostname(input.website);
      if (hostname) {
        const websiteMatch = await this.findWebsiteOwner(hostname);
        if (websiteMatch) {
          throw new AppError(
            `A company with this website already exists: ${websiteMatch.name}`,
            409,
          );
        }
      }
    }

    return companiesRepository.create(input);
  }

  async update(slug: string, input: Partial<{
    name: string;
    website: string | null;
    logoUrl: string | null;
    country: string | null;
    city: string | null;
    description: string | null;
    verified: boolean;
  }>) {
    const company = await companiesRepository.findBySlug(slug);
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    // Changing the website to one owned by ANOTHER company is not allowed.
    if (input.website) {
      const hostname = normalizeHostname(input.website);
      if (hostname) {
        const websiteMatch = await this.findWebsiteOwner(hostname);
        if (websiteMatch && websiteMatch.id !== company.id) {
          throw new AppError(
            `A company with this website already exists: ${websiteMatch.name}`,
            409,
          );
        }
      }
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

  /**
   * Exact owner of a canonical website hostname, if any. Used both by the
   * duplicate-check endpoint (warnings) and the hard create/update block.
   */
  private async findWebsiteOwner(hostname: string) {
    const candidates = await companiesRepository.findByWebsiteLike(hostname);
    return candidates.find(
      (candidate) =>
        !!candidate.website &&
        (() => {
          const storedHost = normalizeHostname(candidate.website);
          return storedHost !== null && isSameWebsiteHostname(storedHost, hostname);
        })(),
    ) ?? null;
  }

  /**
   * Duplicate detection before creating a company. Returns exact website
   * matches (canonical hostname comparison) and companies with similar names,
   * so the caller can warn the user before creating a duplicate entry.
   */
  async checkDuplicates(input: { website?: string; name?: string }) {
    const websiteMatches: CompanyRow[] = [];
    const nameMatches: Array<{ company: CompanyRow; similarity: number }> = [];

    if (input.website) {
      const hostname = normalizeHostname(input.website);
      if (hostname) {
        const candidates = await companiesRepository.findByWebsiteLike(hostname);
        for (const candidate of candidates) {
          if (candidate.website) {
            const storedHost = normalizeHostname(candidate.website);
            if (storedHost !== null && isSameWebsiteHostname(storedHost, hostname)) {
              websiteMatches.push(candidate);
            }
          }
        }
      }
    }

    if (input.name && input.name.trim()) {
      const candidates = await companiesRepository.findByNameTokens(input.name);
      for (const candidate of candidates) {
        const similarity = companyNameSimilarity(input.name, candidate.name);
        if (similarity >= NAME_SIMILARITY_THRESHOLD) {
          nameMatches.push({ company: candidate, similarity });
        }
      }
      nameMatches.sort((a, b) => b.similarity - a.similarity);
    }

    return {
      websiteMatches: websiteMatches.slice(0, 5),
      nameMatches: nameMatches.slice(0, 5),
    };
  }
}

export const companiesService = new CompaniesService();
