import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, closePool } from './db.js';
import { industries } from './schema/industry.js';
import { tags } from './schema/tag.js';
import { companies } from './schema/company.js';
import { users } from './schema/user.js';
import { reviews } from './schema/review.js';
import { reviewTags } from './schema/reviewTag.js';
import { logger } from '../config/logger.js';

const SEED_ADMIN_EMAIL = 'admin@seethrough.com';
const SEED_ADMIN_PASSWORD = 'admin123';
const SEED_ADMIN_NAME = 'Admin';

/**
 * Helper to generate URL-safe slugs.
 * Supports English and Ethiopic (Amharic) characters.
 */
const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u1200-\u137F-]+/g, "")
    .replace(/\-\-+/g, "-")
    // Ensure uniqueness with a CSPRNG suffix (hex) instead of Math.random().
    .concat("-" + randomBytes(4).toString("hex"));
};

async function seed(): Promise<void> {
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
    await db.insert(industries).values(industry).onConflictDoNothing({ target: industries.slug });
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
    await db.insert(tags).values(tag).onConflictDoNothing({ target: tags.slug });
  }
  logger.info(`  ✓ ${tagData.length} tags seeded`);

  // ─── 3. Admin User ───
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  await db.insert(users).values({
    email: SEED_ADMIN_EMAIL,
    passwordHash,
    displayName: SEED_ADMIN_NAME,
    role: 'admin',
    emailVerified: true,
  }).onConflictDoNothing({ target: users.email });
  logger.info(`  ✓ Admin user seeded (${SEED_ADMIN_EMAIL})`);

  // ─── 4. Sample Global Companies (Required for sample reviews) ───
  const allIndustries = await db.select().from(industries);
  const industryMap: Record<string, string> = Object.fromEntries(
    allIndustries.map((i) => [i.slug, i.id]),
  );

  // Fallback industry for companies without a detected match ('consulting').
  const defaultIndustryId: string = industryMap['consulting'] ?? allIndustries[0]!.id;

  const sampleGlobalData = [
    { name: 'Google', slug: 'google', industrySlug: 'technology', country: 'USA', city: 'Mountain View' },
    { name: 'Stripe', slug: 'stripe', industrySlug: 'finance', country: 'USA', city: 'San Francisco' },
    { name: 'Amazon', slug: 'amazon', industrySlug: 'e-commerce', country: 'USA', city: 'Seattle' },
    { name: 'Netflix', slug: 'netflix', industrySlug: 'media-entertainment', country: 'USA', city: 'Los Gatos' },
  ];

  for (const c of sampleGlobalData) {
    await db.insert(companies).values({
      name: c.name,
      slug: c.slug,
      industryId: industryMap[c.industrySlug] ?? defaultIndustryId,
      country: c.country,
      city: c.city,
      verified: true,
    }).onConflictDoNothing({ target: companies.slug });
  }

  // ─── 5. High-Quality Tech Company Information (Researched) ───
  logger.info('  Seeding researched tech companies...');
  const detailedTechCompanies = [
    {
      name: 'AIT Technologies',
      slug: 'ait-technologies',
      website: 'https://ait.technology',
      industrySlug: 'technology',
      description:
        'Leading Ethiopian BPO, call center, and software development provider specializing in digital transformation.',
      verified: true,
    },
    {
      name: 'Ablaze It Laboratories And Engineering PLC',
      slug: 'ablaze-it-laboratories',
      website: 'https://www.ablazelabs.com',
      industrySlug: 'technology',
      description:
        'A pioneering startup studio and technology firm focusing on custom software and IT outsourcing.',
      verified: true,
    },
    {
      name: 'AddisFly',
      slug: 'addisfly',
      website: 'https://addisfly.com',
      industrySlug: 'hospitality-tourism',
      description:
        'IATA-accredited digital travel agency for instant flight bookings and diaspora travel services.',
      verified: true,
    },
    {
      name: 'Afriwork Recruitment',
      slug: 'afriwork-recruitment',
      website: 'https://afriwork.com',
      industrySlug: 'consulting',
      description: "Ethiopia's largest talent marketplace connecting professionals with top employers.",
      verified: true,
    },
    {
      name: 'Dodai Manufacturing PLC',
      slug: 'dodai-manufacturing',
      website: 'https://dodai.co',
      industrySlug: 'manufacturing',
      description:
        "Electric vehicle and mobility infrastructure company building Africa's largest battery swapping network.",
      verified: true,
    },
    {
      name: 'Chapa Financial Technologies',
      slug: 'chapa-financial-technologies',
      website: 'https://chapa.co',
      industrySlug: 'finance',
      description:
        'Leading online payment gateway enabling businesses in Ethiopia to accept local and international payments.',
      verified: true,
    },
    {
      name: 'LakiPay Financial Technologies S.C',
      slug: 'lakipay-financial-technologies',
      website: 'https://lakipay.com',
      industrySlug: 'finance',
      description:
        'AI-powered superapp and licensed payment system operator for remittances and commerce.',
      verified: true,
    },
    {
      name: 'ZayRide',
      slug: 'zayride',
      website: 'https://zayride.com',
      industrySlug: 'transportation-logistics',
      description:
        'Customer-centric on-demand taxi, delivery, and ambulance service provider in Addis Ababa.',
      verified: true,
    },
    {
      name: 'Gebeya',
      slug: 'gebeya',
      website: 'https://gebeya.com',
      industrySlug: 'technology',
      description:
        "SaaS-enabled marketplace connecting Africa's best tech talent with global opportunities.",
      verified: true,
    },
    {
      name: 'Transsion Manufacturing Plc.',
      slug: 'transsion-manufacturing',
      website: 'https://www.transsion.com',
      industrySlug: 'manufacturing',
      description:
        'Global mobile phone manufacturer (TECNO, Infinix, Itel) with significant operations in Ethiopia.',
      verified: true,
    },
  ];

  for (const c of detailedTechCompanies) {
    await db.insert(companies).values({
      name: c.name,
      slug: c.slug,
      industryId: industryMap[c.industrySlug] ?? defaultIndustryId,
      website: c.website,
      description: c.description,
      country: 'Ethiopia',
      city: 'Addis Abeba',
      verified: c.verified,
    }).onConflictDoNothing({ target: companies.slug });
  }
  logger.info(`  ✓ ${detailedTechCompanies.length} researched tech companies seeded`);

  // ─── 6. Bulk Ethiopian Companies ───
  logger.info('  Seeding Ethiopian company list...');
  const ethiopianCompanyNames = [
    "A AND S PILLAR TRADING", "ADDIS PROPERTY MARKETING GROUP PLC", "AIT Technologies", "AND TRADING PLC",
    "AR SOLUTION TRADING PLC", "ARKI PLASTIC PRODUCTS FACTORY PLC", "AT GLOBAL BUSINESS PLC", "Abbay Media",
    "Ablaze It Laboratories And Engineering PLC", "Addis Finder trading plc", "AddisFly", "Adiamat Trading Plc",
    "Afri Flame holding", "Afriwork Recruitment", "Akoya Properties", "Alhabek Trading PLC", "Alloy Aluminum Trading PLC",
    "Amrogn Chicken", "Aquila ICT Solution", "Arfen Trading PLC.", "Avi Impex trading plc", "Awura Computing PLC",
    "B D A BUSINESS AND AGRICULTURAL DEVELOPMENT PLC", "BANEOL GENERAL CONSTRUCTION AND TRADE PLC", "BEZAW CURBSIDE PLC",
    "BRONQ ENGLISH LANGUAGE SCHOOL", "BUILDERS CREAMY TRADING PLC", "Bemistre Furnishings and Interior", "BeteSeb Academy",
    "Bilos Pastry PLC", "Biniyam Tsegaye internet café", "Blih Marketing and Communications plc", "Bora Integrated Commercial Farm Plc",
    "Boutique", "Brana Gospel Focus Ministry", "Bright Techno Tonic plc", "CHINET LINK TECH ONE MEMBER P L C",
    "CONTINENTAL PRINTERS PLC", "Chipchip E-commerce Platform", "Cosmic Technologies", "DLM PLC", "Dagi Spa",
    "Dema Hope Real Estate", "Dipcom Technology Institute", "Dodai Manufacturing PLC", "Dongtang Business Consultancy PLC.",
    "Dr Abel Specialty Dental Clinic", "Dream Technologies Plc", "Dynamic Planners PLC", "EASE Engineering PLC",
    "Easy Production", "Esubalew Workineh Tegegne", "Ethio America academy", "FAMTRA TRADING PLC", "FG Business group 8085",
    "Fidel", "G POWER MANUFACTURING PLC", "GROUP PLC", "Golden Design", "Gouldon import and export",
    "Haset Information Technology PLC", "Hashtag Advertising", "Horizon Trading plc", "Hulucare Dermatology and Aesthetics Specialized Clinic",
    "Information Systems Services PLC", "JUNTU TECHNOLOGY TRADING PLC", "Jasper Ethiopia Business Group", "KLIK INVESTMENT PLC",
    "Kefeta Training and Consulting PLC", "Kefyalew pharmaceuticals and medical supplies", "Kelem Educational Consultancy P.L.C",
    "Kinetic Dawn Multimedia", "Komari Beverage", "LIANA HEALTH CARE", "LakiPay Financial Technologies S.C",
    "Lavoca Trading PLC", "Le Solution PLC", "Leapfrog Software Technology Africa Plc", "LeuNet ICT Solutions",
    "LucyBridge PLC", "Lumen Communication Marketing And Technologies PLC", "M Advertising activities", "MAG PLASTIC PLC",
    "MELA EXPRESS DELIVERY", "MELO DERMATOLOGY AND SKINCARE TRANDING  PLC", "MENAB TRADING PLC", "MODETH Outsource P.L.C",
    "MORESAFE ETHIOPIA ELECTRICAL EQUPMENT IMPORT", "MRKY TRADING PLC", "MUBAREK AHMED HUSSEN", "Mamokacha PLC ማሞ ካቻ ኃ/የተ/የግ/ማህበር",
    "Manna Diagnostic Center", "Maraki English", "Marselam Trading PLC", "Melke tour and travel agency", "Mesob Studios Plc.",
    "Metropolitan Real Estate Plc", "Misrak Food complex plc", "Moringa Farms plc", "Nathan general trading plc",
    "Netsa Trading PLC", "Noble Homes", "On Point Management Solutions", "Phoenix Telecom Plc", "Prime Medicare PLC",
    "Private Client", "Prokal Technologies Solutions", "REDAT HEALTH CARE PLC", "Reality Share Company", "Repi Soap & Detergent PLC",
    "Rise Addis Properties Plc", "Royal Real Estate", "Ruftana Trading plc", "SACON CONSTRUCTION AND TRADING PLC",
    "SAL Trading PLC", "SANTE MEDICAL CENTER", "SARIA CONSULTANCY P L C", "SCHOOL PLC", "SHI-FAM TRADING PLC",
    "SOKA IMPORT PLC", "Selam General Hospital", "Sheger Wedding Store", "Silicon labs", "Skylight Technology Group PLC",
    "Slope  Construction & Trade", "Social Impact Trading Plc", "Sorana Industry and Engineering PLC", "TENSAE DEMISSIE JUFFAR",
    "TUTU NOODLES", "TWO TWENTY PARTNERS DESIGN AND CONSTRUCTION PLC", "Tbab Trading PLC", "Tech Equations Technology",
    "Tedla Ambulance", "Tekeba & Friends Property Valuation and Management PLC", "Tekeste Zerihun general contractor",
    "Tewos Trading PLC", "Tigat Saving and Credit Coop", "Tongfang system Integration p.l.c", "Top training institute",
    "Transsion Manufacturing Plc.", "Trego X Trading PLC", "Trident Engineering Plc", "UNI MAS ENGENRING PLC",
    "Uplift Solution", "Vector four engineering plc", "WANGO IMPORT AND EXPORT", "WETRUCK TECHENABLE SOLUTION",
    "Winner Pipes", "Ximar Concrete manufacturing plc", "YES TRADING PLC", "YONAB FAMILY TRADING PLC", "YONATAN BT PLC",
    "Yimaru Academy PLC", "Zagol system", "Zainx technology plc", "Zer trading plc", "Zota Engineering PLC",
    "benol pharmaceuticals plc", "ennovo software development plc", "gheero", "iSON xperiecnes Ethiocall PLC",
    "irack IT Solution", "noah real estate plc", "wavelet Engineering PLC", "wb interior", "ሸዋ ሆምስ ሪል እስቴት",
    "አስናቀ ማስታወቅያ", "ዘ ታቦር ትሬዲንግ ኃላፊነቱ የተወሰነ የግል ማህበር", "ደመራ ኢንጅነሪንግና ኮንስትራክሽን",
    "ድል የገንዘብ ቁጠባና ብድር ኃላፊነቱ የተወሰነ የህብረት ሥራ ማኅበር"
  ];

  // We link these to 'Consulting' or 'General Business'. Using 'consulting' as a safe fallback.
  // Skip companies already seeded above (e.g. the researched tech companies) to avoid duplicates.
  const existingCompanyNames = new Set(
    (await db.select({ name: companies.name }).from(companies)).map((c) =>
      c.name.trim().toLowerCase(),
    ),
  );
  const newEthiopianNames = ethiopianCompanyNames.filter(
    (name) => !existingCompanyNames.has(name.trim().toLowerCase()),
  );

  const ethiopianPrepared = newEthiopianNames.map((name) => ({
    name,
    slug: generateSlug(name),
    industryId: defaultIndustryId,
    country: "Ethiopia",
    city: "Addis Abeba",
    verified: false,
  }));

  const chunkSize = 50;
  for (let i = 0; i < ethiopianPrepared.length; i += chunkSize) {
    const chunk = ethiopianPrepared.slice(i, i + chunkSize);
    await db.insert(companies).values(chunk).onConflictDoNothing();
  }
  logger.info(`  ✓ ${newEthiopianNames.length} Ethiopian companies seeded`);

  // ─── 7. Sample Reviews (using admin user) ───
  const adminUser = await db.select().from(users).where(eq(users.email, SEED_ADMIN_EMAIL)).limit(1);
  const userId = adminUser[0]?.id;

  if (userId) {
    const reviewData = [
      { companySlug: 'google', title: 'Great place for engineers', overallRating: 4, tagNames: ['Good Culture', 'Great Benefits'] },
      { companySlug: 'stripe', title: 'Best engineering culture', overallRating: 5, tagNames: ['Good Culture', 'Remote Friendly'] },
      { companySlug: 'amazon', title: 'High pay but brutal', overallRating: 3, tagNames: ['Toxic Environment', 'Long Hours'] },
      { companySlug: 'netflix', title: 'Freedom and responsibility', overallRating: 4, tagNames: ['Innovation', 'Fair Compensation'] },
    ];

    const allTags = await db.select().from(tags);
    const tagMap: Record<string, number> = Object.fromEntries(
      allTags.map((t) => [t.name, t.id]),
    );
    const seededCompanies = await db.select().from(companies);

    for (const review of reviewData) {
      const company = seededCompanies.find((c) => c.slug === review.companySlug);
      if (!company) continue;

      const [insertedReview] = await db.insert(reviews).values({
        publicId: `seed-${review.companySlug}`,
        userId,
        companyId: company.id,
        title: review.title,
        pros: 'Pros list here...',
        cons: 'Cons list here...',
        overallRating: review.overallRating,
        isCurrentEmployee: true,
        employmentStatus: 'full-time',
        jobTitle: 'Software Engineer',
      }).onConflictDoNothing().returning();

      if (insertedReview) {
        for (const tagName of review.tagNames) {
          const tagId = tagMap[tagName];
          if (tagId) await db.insert(reviewTags).values({ reviewId: insertedReview.id, tagId });
        }
      }
    }
  }

  // ─── 8. Consolidate Stats ───
  logger.info('  Consolidating stats...');
  const finalCompanies = await db.select().from(companies);
  for (const company of finalCompanies) {
    const companyReviews = await db.select().from(reviews).where(eq(reviews.companyId, company.id));
    if (companyReviews.length === 0) continue;

    const ratings = companyReviews
      .map((r) => r.overallRating)
      .filter((r): r is number => r !== null && r !== undefined);
    if (ratings.length === 0) continue;
    const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);

    await db.update(companies).set({
      reviewCount: companyReviews.length,
      averageRating: avg,
    }).where(eq(companies.id, company.id));
  }

  logger.info('✅ Seed complete!');
  await closePool();
  process.exit(0);
}

seed().catch((error) => {
  logger.error({ err: error }, '❌ Seed failed');
  closePool().finally(() => process.exit(1));
});
