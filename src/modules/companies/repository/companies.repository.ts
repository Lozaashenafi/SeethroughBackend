import { eq, and, ilike, or, desc, count, type SQL } from 'drizzle-orm';
import { db } from '../../../database/db.js';
import { companies } from '../../../database/schema/company.js';

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  industryId: string;
  website: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
  reviewCount: number;
  averageRating: string | null;
  recommendationRate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ListCompaniesParams {
  search?: string;
  industry?: string;
  country?: string;
  city?: string;
  page: number;
  limit: number;
}

export class CompaniesRepository {
  async create(input: {
    name: string;
    slug: string;
    industryId: string;
    website?: string | null;
    country?: string | null;
    city?: string | null;
    description?: string | null;
  }): Promise<CompanyRow> {
    const [company] = await db
      .insert(companies)
      .values({
        name: input.name,
        slug: input.slug,
        industryId: input.industryId,
        website: input.website ?? null,
        country: input.country ?? null,
        city: input.city ?? null,
        description: input.description ?? null,
      })
      .returning();

    return company;
  }

  async update(
    slug: string,
    input: Partial<{
      name: string;
      website: string | null;
      country: string | null;
      city: string | null;
      description: string | null;
      verified: boolean;
    }>,
  ): Promise<CompanyRow | null> {
    const [company] = await db
      .update(companies)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(companies.slug, slug))
      .returning();

    return company ?? null;
  }

  async delete(slug: string): Promise<boolean> {
    const [deleted] = await db
      .delete(companies)
      .where(eq(companies.slug, slug))
      .returning({ id: companies.id });

    return !!deleted;
  }

  async findAll(params: ListCompaniesParams): Promise<{ data: CompanyRow[]; total: number }> {
    const conditions: SQL[] = [];

    if (params.search) {
      const searchCondition = or(
        ilike(companies.name, `%${params.search}%`),
        ilike(companies.slug, `%${params.search}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (params.industry) {
      conditions.push(eq(companies.industryId, params.industry));
    }

    if (params.country) {
      conditions.push(eq(companies.country, params.country));
    }

    if (params.city) {
      conditions.push(eq(companies.city, params.city));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (params.page - 1) * params.limit;

    const data = await db
      .select()
      .from(companies)
      .where(whereClause)
      .orderBy(desc(companies.reviewCount), desc(companies.averageRating))
      .limit(params.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ total: count() })
      .from(companies)
      .where(whereClause);

    return { data, total: totalResult?.total ?? 0 };
  }

  async findBySlug(slug: string): Promise<CompanyRow | null> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug));
    return company ?? null;
  }

  async updateStats(id: string, stats: { reviewCount: number; averageRating: string | null; recommendationRate: number }): Promise<void> {
    await db
      .update(companies)
      .set({
        reviewCount: stats.reviewCount,
        averageRating: stats.averageRating,
        recommendationRate: stats.recommendationRate,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id));
  }
}

export const companiesRepository = new CompaniesRepository();
