import { eq, and, ilike, or, desc, count, inArray, type SQL } from 'drizzle-orm';
import { db, type DatabaseTx } from '../../../database/db.js';
import { companies } from '../../../database/schema/company.js';
import { reviews } from '../../../database/schema/review.js';
import { comments } from '../../../database/schema/comment.js';
import { reviewVotes } from '../../../database/schema/reviewVote.js';
import { reviewTags } from '../../../database/schema/reviewTag.js';
import { reports } from '../../../database/schema/report.js';

export interface CompanyRow {
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
    logoUrl?: string | null;
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
        logoUrl: input.logoUrl ?? null,
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
      logoUrl: string | null;
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
    // Cascade delete in a single transaction: child records must be removed
    // before the company itself to avoid FK constraint violations.
    return db.transaction(async (tx) => {
      const [company] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);
      if (!company) return false;

      // All reviews belonging to this company
      const companyReviews = await tx
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.companyId, company.id));
      const reviewIds = companyReviews.map((r) => r.id);

      if (reviewIds.length > 0) {
        // Comments on those reviews (for reports that reference them)
        const reviewComments = await tx
          .select({ id: comments.id })
          .from(comments)
          .where(inArray(comments.reviewId, reviewIds));
        const commentIds = reviewComments.map((c) => c.id);

        // Reports may reference the review directly or one of its comments
        const reportConditions: SQL[] = [inArray(reports.reviewId, reviewIds)];
        if (commentIds.length > 0) {
          reportConditions.push(inArray(reports.commentId, commentIds));
        }

        await tx.delete(reports).where(or(...reportConditions));
        await tx.delete(comments).where(inArray(comments.reviewId, reviewIds));
        await tx.delete(reviewVotes).where(inArray(reviewVotes.reviewId, reviewIds));
        await tx.delete(reviewTags).where(inArray(reviewTags.reviewId, reviewIds));
        await tx.delete(reviews).where(inArray(reviews.id, reviewIds));
      }

      const [deleted] = await tx
        .delete(companies)
        .where(eq(companies.slug, slug))
        .returning({ id: companies.id });

      return !!deleted;
    });
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

  /**
   * Companies whose website shares the given hostname, for duplicate
   * detection. The DB column stores websites in varying forms (with/without
   * protocol, `www.`, trailing slash), so we narrow with ilike over the
   * hostname AND its parent domains (a subdomain like `shop.base.com` must
   * also surface companies stored as `base.com`) and let the caller normalize
   * + compare hostnames precisely.
   */
  async findByWebsiteLike(hostname: string): Promise<CompanyRow[]> {
    const labels = hostname.split('.');
    // Suffixes down to the registrable-ish domain (last 2 labels), e.g.
    // `shop.base.com` -> [`shop.base.com`, `base.com`].
    const tokens = labels
      .map((_, index) => labels.slice(index).join('.'))
      .filter((token) => token.split('.').length >= 2);

    const conditions = tokens.map((token) => ilike(companies.website, `%${token}%`));
    return db
      .select()
      .from(companies)
      .where(or(...conditions))
      .limit(30);
  }

  /**
   * Companies whose name contains any significant token of the given name,
   * for similar-name detection. Narrowing happens in SQL; the caller scores
   * and filters in JS.
   */
  async findByNameTokens(name: string): Promise<CompanyRow[]> {
    const tokens = name
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ''))
      .filter((t) => t.length >= 2)
      .slice(0, 4);

    if (tokens.length === 0) return [];

    const conditions = tokens.map((token) => ilike(companies.name, `%${token}%`));
    return db
      .select()
      .from(companies)
      .where(or(...conditions))
      .limit(30);
  }

  async updateStats(id: string, stats: { reviewCount: number; averageRating: string | null; recommendationRate: number }): Promise<void> {
    return this.updateStatsWithClient(db, id, stats);
  }

  async updateStatsWithClient(
    client: typeof db | DatabaseTx,
    id: string,
    stats: { reviewCount: number; averageRating: string | null; recommendationRate: number },
  ): Promise<void> {
    await client
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
