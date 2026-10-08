import { db, closePool } from './db.js';
import { companies } from './schema/company.js';
import { reviewsRepository } from '../modules/reviews/repository/reviews.repository.js';
import { companiesRepository } from '../modules/companies/repository/companies.repository.js';
import { logger } from '../config/logger.js';

/**
 * The column defaults `average_rating` to 0 while a recomputed "no rated
 * reviews" average is NULL. Both render as "N/A", so they must not count as a
 * difference — otherwise the first run would rewrite (and re-timestamp) every
 * company that has never had a review.
 */
function ratingValue(value: string | null): number {
  return Number(value ?? 0);
}

/**
 * Recomputes every company's denormalized stats (review count, average rating,
 * recommended %) from the reviews it actually has.
 *
 * The counters are maintained incrementally by the API whenever a review is
 * created, edited, moderated, deleted or removed by the report/user deletion
 * flows, so this script is only needed after the *rule* itself changes — the
 * stored numbers of companies whose reviews predate the change would otherwise
 * keep the old value forever.
 *
 * Idempotent and non-destructive: it writes derived values only, never review
 * content, and it skips companies whose stored stats already match (so
 * `updated_at`, which the admin UI shows as "Last Updated", is not churned).
 */
async function recomputeStats(): Promise<void> {
  const allCompanies = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      reviewCount: companies.reviewCount,
      averageRating: companies.averageRating,
      recommendationRate: companies.recommendationRate,
    })
    .from(companies);

  const changed: Array<{
    slug: string;
    from: { reviewCount: number; averageRating: string | null; recommendationRate: number };
    to: { reviewCount: number; averageRating: string | null; recommendationRate: number };
  }> = [];

  for (const company of allCompanies) {
    const stats = await reviewsRepository.getCompanyReviewStats(company.id);

    const current = {
      reviewCount: company.reviewCount,
      averageRating: company.averageRating ?? null,
      recommendationRate: company.recommendationRate,
    };

    if (
      stats.reviewCount === current.reviewCount &&
      ratingValue(stats.averageRating) === ratingValue(current.averageRating) &&
      stats.recommendationRate === current.recommendationRate
    ) {
      continue;
    }

    await companiesRepository.updateStats(company.id, stats);
    changed.push({ slug: company.slug, from: current, to: stats });
  }

  for (const entry of changed) {
    logger.info(
      {
        slug: entry.slug,
        from: entry.from,
        to: entry.to,
      },
      'Company stats corrected',
    );
  }

  logger.info(
    { scanned: allCompanies.length, updated: changed.length },
    changed.length > 0
      ? 'Company stats recomputed'
      : 'Company stats already up to date — nothing to do',
  );
}

recomputeStats()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, '❌ Company stats recompute failed');
    await closePool().finally(() => process.exit(1));
  });
