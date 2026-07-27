import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, closePool } from './db.js';
import { industries } from './schema/industry.js';
import { tags } from './schema/tag.js';
import { companies } from './schema/company.js';
import { admins } from './schema/admin.js';
import { anonymousIdentities } from './schema/anonymousIdentity.js';
import { reviews } from './schema/review.js';
import { reviewTags } from './schema/reviewTag.js';
import { logger } from '../config/logger.js';

async function seed() {
  logger.info('🌱 Starting database seed...');

  // ─── 1. Industries ───
  logger.info('  Seeding industries...');

  const industryData = [
    { name: 'Technology', slug: 'technology' },
    { name: 'Finance', slug: 'finance' },
    { name: 'Healthcare', slug: 'healthcare' },
    { name: 'Education', slug: 'education' },
    { name: 'Retail', slug: 'retail' },
    { name: 'Manufacturing', slug: 'manufacturing' },
    { name: 'Media & Entertainment', slug: 'media-entertainment' },
    { name: 'Telecommunications', slug: 'telecommunications' },
    { name: 'Transportation & Logistics', slug: 'transportation-logistics' },
    { name: 'Real Estate', slug: 'real-estate' },
    { name: 'Hospitality & Tourism', slug: 'hospitality-tourism' },
    { name: 'Energy & Utilities', slug: 'energy-utilities' },
    { name: 'Aerospace & Defense', slug: 'aerospace-defense' },
    { name: 'Agriculture', slug: 'agriculture' },
    { name: 'Consulting', slug: 'consulting' },
    { name: 'E-commerce', slug: 'e-commerce' },
    { name: 'Legal', slug: 'legal' },
    { name: 'Non-Profit', slug: 'non-profit' },
    { name: 'Government', slug: 'government' },
    { name: 'Insurance', slug: 'insurance' },
  ];

  for (const industry of industryData) {
    await db
      .insert(industries)
      .values(industry)
      .onConflictDoNothing({ target: industries.slug });
  }

  logger.info(`  ✓ ${industryData.length} industries seeded`);

  // ─── 2. Tags ───
  logger.info('  Seeding tags...');

  const tagData = [
    { name: 'Good Culture', slug: 'good-culture' },
    { name: 'Great Benefits', slug: 'great-benefits' },
    { name: 'Work-Life Balance', slug: 'work-life-balance' },
    { name: 'Career Growth', slug: 'career-growth' },
    { name: 'Good Management', slug: 'good-management' },
    { name: 'Remote Friendly', slug: 'remote-friendly' },
    { name: 'Diversity & Inclusion', slug: 'diversity-inclusion' },
    { name: 'Innovation', slug: 'innovation' },
    { name: 'Team Collaboration', slug: 'team-collaboration' },
    { name: 'Fair Compensation', slug: 'fair-compensation' },
    { name: 'Fast Paced', slug: 'fast-paced' },
    { name: 'Toxic Environment', slug: 'toxic-environment' },
    { name: 'Poor Management', slug: 'poor-management' },
    { name: 'Long Hours', slug: 'long-hours' },
    { name: 'Great Mentorship', slug: 'great-mentorship' },
  ];

  for (const tag of tagData) {
    await db
      .insert(tags)
      .values(tag)
      .onConflictDoNothing({ target: tags.slug });
  }

  logger.info(`  ✓ ${tagData.length} tags seeded`);

  // ─── 3. Admin ───
  logger.info('  Seeding admin user...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  await db
    .insert(admins)
    .values({
      email: 'admin@seethrough.com',
      passwordHash,
      name: 'Admin',
    })
    .onConflictDoNothing({ target: admins.email });

  logger.info('  ✓ Admin user seeded (admin@seethrough.com / admin123)');

  // ─── 4. Sample Companies ───
  logger.info('  Seeding sample companies...');

  const allIndustries = await db.select().from(industries);
  const industryMap = Object.fromEntries(
    allIndustries.map((i) => [i.slug, i.id]),
  );

  const companyData = [
    {
      name: 'Google',
      slug: 'google',
      industrySlug: 'technology',
      website: 'https://google.com',
      country: 'United States',
      city: 'Mountain View',
      description: 'Global technology leader in internet services, AI, and cloud computing.',
      verified: true,
    },
    {
      name: 'Stripe',
      slug: 'stripe',
      industrySlug: 'technology',
      website: 'https://stripe.com',
      country: 'United States',
      city: 'San Francisco',
      description: 'Online payment processing platform for internet businesses.',
      verified: true,
    },
    {
      name: 'Goldman Sachs',
      slug: 'goldman-sachs',
      industrySlug: 'finance',
      website: 'https://goldmansachs.com',
      country: 'United States',
      city: 'New York',
      description: 'Leading global investment banking and securities firm.',
      verified: true,
    },
    {
      name: 'Mayo Clinic',
      slug: 'mayo-clinic',
      industrySlug: 'healthcare',
      website: 'https://mayoclinic.org',
      country: 'United States',
      city: 'Rochester',
      description: 'Non-profit academic medical center for clinical practice, education, and research.',
      verified: true,
    },
    {
      name: 'Tesla',
      slug: 'tesla',
      industrySlug: 'manufacturing',
      website: 'https://tesla.com',
      country: 'United States',
      city: 'Austin',
      description: 'Electric vehicle and clean energy company.',
      verified: true,
    },
    {
      name: 'Amazon',
      slug: 'amazon',
      industrySlug: 'e-commerce',
      website: 'https://amazon.com',
      country: 'United States',
      city: 'Seattle',
      description: 'Global e-commerce, cloud computing, and digital streaming company.',
      verified: true,
    },
    {
      name: 'Netflix',
      slug: 'netflix',
      industrySlug: 'media-entertainment',
      website: 'https://netflix.com',
      country: 'United States',
      city: 'Los Gatos',
      description: 'Global streaming entertainment service.',
      verified: true,
    },
    {
      name: 'Shopify',
      slug: 'shopify',
      industrySlug: 'e-commerce',
      website: 'https://shopify.com',
      country: 'Canada',
      city: 'Ottawa',
      description: 'Leading e-commerce platform for online stores and retail systems.',
      verified: false,
    },
  ];

  let companiesSeeded = 0;
  for (const company of companyData) {
    const industryId = industryMap[company.industrySlug];
    if (!industryId) {
      logger.warn(`  ⚠ No industry found for slug "${company.industrySlug}", skipping ${company.name}`);
      continue;
    }

    await db
      .insert(companies)
      .values({
        name: company.name,
        slug: company.slug,
        industryId,
        website: company.website,
        country: company.country,
        city: company.city,
        description: company.description,
        verified: company.verified,
      })
      .onConflictDoNothing({ target: companies.slug });
    companiesSeeded++;
  }

  logger.info(`  ✓ ${companiesSeeded} companies seeded`);

  // ─── 5. Anonymous Identity ───
  logger.info('  Seeding anonymous identity for sample reviews...');

  const sessionToken = nanoid(32);
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

  const [anonIdentity] = await db
    .insert(anonymousIdentities)
    .values({
      publicId: nanoid(16),
      sessionTokenHash: tokenHash,
    })
    .onConflictDoNothing({ target: anonymousIdentities.publicId })
    .returning();

  // ─── 6. Sample Reviews (insert only, no stats update yet) ───
  const allCompanies = await db.select().from(companies);
  const anonId = anonIdentity?.id ?? (await db.select().from(anonymousIdentities).limit(1))[0]?.id;

  if (anonId && allCompanies.length > 0) {
    const reviewData = [
      {
        companySlug: 'google',
        title: 'Great place for engineers, but politics can be tough',
        pros: 'Excellent compensation, amazing perks, smart colleagues, great learning opportunities.',
        cons: 'Promotion process is slow and political. Large company bureaucracy can be frustrating.',
        overallRating: 4,
        workLifeBalance: 3,
        culture: 4,
        management: 3,
        compensation: 5,
        opportunities: 4,
        jobTitle: 'Senior Software Engineer',
        employmentStatus: 'full-time' as const,
        isCurrentEmployee: true,
        tagNames: ['Good Culture', 'Great Benefits', 'Fair Compensation'],
      },
      {
        companySlug: 'stripe',
        title: 'Best engineering culture I have experienced',
        pros: 'Incredibly smart team, excellent engineering practices, great developer experience. Remote-first culture done right.',
        cons: 'Can be intense during product launches. On-call rotation can be draining.',
        overallRating: 5,
        workLifeBalance: 4,
        culture: 5,
        management: 4,
        compensation: 5,
        opportunities: 4,
        jobTitle: 'Software Engineer',
        employmentStatus: 'full-time' as const,
        isCurrentEmployee: true,
        tagNames: ['Good Culture', 'Work-Life Balance', 'Great Mentorship', 'Remote Friendly'],
      },
      {
        companySlug: 'amazon',
        title: 'High pay but brutal environment',
        pros: 'Competitive salary and benefits. Massive scale provides unique learning opportunities.',
        cons: 'Extremely high pressure culture. PIP culture creates constant stress. Work-life balance is poor.',
        overallRating: 3,
        workLifeBalance: 2,
        culture: 2,
        management: 2,
        compensation: 5,
        opportunities: 4,
        jobTitle: 'Software Development Engineer',
        employmentStatus: 'full-time' as const,
        isCurrentEmployee: false,
        tagNames: ['Fair Compensation', 'Fast Paced', 'Toxic Environment', 'Long Hours'],
      },
      {
        companySlug: 'netflix',
        title: 'Freedom and responsibility at its finest',
        pros: 'Freedom to make decisions without layers of approval. Highly talented peers. Compensation is among the best in the industry.',
        cons: 'Very high expectations. Performance culture means constant pressure. Job security is lower than typical.',
        overallRating: 4,
        workLifeBalance: 3,
        culture: 4,
        management: 4,
        compensation: 5,
        opportunities: 3,
        jobTitle: 'Senior Product Manager',
        employmentStatus: 'full-time' as const,
        isCurrentEmployee: true,
        tagNames: ['Good Culture', 'Innovation', 'Fair Compensation', 'Team Collaboration'],
      },
    ];

    // Fetch all tags once
    const allTags = await db.select().from(tags);
    const tagMap = Object.fromEntries(allTags.map((t) => [t.name, t.id]));
    let reviewsSeeded = 0;

    for (const review of reviewData) {
      const company = allCompanies.find((c) => c.slug === review.companySlug);
      if (!company) {
        logger.warn(`  ⚠ Company not found: ${review.companySlug}, skipping review`);
        continue;
      }

      // Use deterministic publicId so the seed is idempotent on re-runs
      const reviewPublicId = `seed-${review.companySlug}`;
      const [insertedReview] = await db
        .insert(reviews)
        .values({
          publicId: reviewPublicId,
          anonymousId: anonId,
          companyId: company.id,
          title: review.title,
          pros: review.pros,
          cons: review.cons,
          overallRating: review.overallRating,
          workLifeBalance: review.workLifeBalance,
          culture: review.culture,
          management: review.management,
          compensation: review.compensation,
          opportunities: review.opportunities,
          isCurrentEmployee: review.isCurrentEmployee,
          employmentStatus: review.employmentStatus,
          jobTitle: review.jobTitle,
        })
        .onConflictDoNothing({ target: reviews.publicId })
        .returning();

      if (!insertedReview) {
        logger.info(`  ⏭ Review already exists for ${review.companySlug}, skipping`);
        continue;
      }
      reviewsSeeded++;

      // Link tags to the review (no onConflict needed — each review+tag combo is unique by design in a seed)
      for (const tagName of review.tagNames) {
        const tagId = tagMap[tagName];
        if (tagId) {
          await db.insert(reviewTags).values({ reviewId: insertedReview.id, tagId });
        }
      }
    }

    logger.info(`  ✓ ${reviewsSeeded} sample reviews seeded`);

    // ─── 7. Consolidate company review stats ───
    logger.info('  Consolidating company review stats...');
    for (const company of allCompanies) {
      const companyReviews = await db
        .select({
          overallRating: reviews.overallRating,
          isCurrentEmployee: reviews.isCurrentEmployee,
        })
        .from(reviews)
        .where(eq(reviews.companyId, company.id));

      if (companyReviews.length === 0) continue;

      const ratings = companyReviews
        .filter((r): r is { overallRating: number; isCurrentEmployee: boolean | null } => r.overallRating !== null)
        .map((r) => r.overallRating);

      const avg = ratings.length > 0
        ? String((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : '0';

      const currentEmployees = companyReviews.filter((r) => r.isCurrentEmployee === true).length;

      await db
        .update(companies)
        .set({
          reviewCount: companyReviews.length,
          averageRating: avg,
          recommendationRate: currentEmployees,
        })
        .where(eq(companies.id, company.id));
    }
    logger.info('  ✓ Company stats consolidated');
  } else {
    logger.info('  ⏭ Skipping sample reviews (no anonymous identity or companies available)');
  }

  logger.info('✅ Seed complete!');
  await closePool();
  process.exit(0);
}

seed().catch((error) => {
  logger.error({ err: error }, '❌ Seed failed');
  closePool().finally(() => process.exit(1));
});
