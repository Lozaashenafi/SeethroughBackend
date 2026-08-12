// Helpers for detecting existing/similar companies when a user adds a new one.
// Used by the POST /companies duplicate-check flow so users are warned before
// creating a duplicate entry.

/** Lowercases and reduces a company name to a comparable token string. */
export function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Extracts the canonical hostname from a website URL (lowercased, without the
 * leading `www.`). Tolerates missing protocols and trailing slashes/paths.
 * Returns null when the value cannot be parsed as a URL.
 */
export function normalizeHostname(website: string): string | null {
  try {
    let url = website.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * True when two canonical hostnames are the same OR one is a subdomain of the
 * other (e.g. `chapa.co` and `shop.chapa.co`). Subdomains belong to the same
 * website for duplicate purposes.
 */
export function isSameWebsiteHostname(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const curr = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Similarity of two company names in [0, 1]. Combines token Jaccard overlap,
 * substring containment (e.g. "Apple" vs "Apple Inc."), and Levenshtein ratio
 * for close spellings. 1 = identical.
 */
export function companyNameSimilarity(a: string, b: string): number {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const setA = new Set(na.split(' '));
  const setB = new Set(nb.split(' '));

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  // Fraction of the QUERY's tokens that matched — catches short queries
  // against long names ("chapa" vs "Chapa Financial Technologies"), which
  // plain Jaccard dilutes to ~1/N.
  const precision = setA.size === 0 ? 0 : intersection / setA.size;

  const containment =
    na.includes(nb) || nb.includes(na)
      ? Math.min(na.length, nb.length) / Math.max(na.length, nb.length)
      : 0;

  const levRatio = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);

  return Math.max(jaccard, precision, containment, levRatio);
}

/** Minimum similarity for a name to be reported as a possible duplicate. */
export const NAME_SIMILARITY_THRESHOLD = 0.45;
