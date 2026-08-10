import { createHash } from 'node:crypto';

// Privacy-preserving duplicate detection. Instead of comparing raw text
// (which would require storing it twice), we store a one-way fingerprint
// (sha256) of the normalized content. "Nearly identical" detection uses an
// n-gram Jaccard similarity computed over the same normalized text.

export function normalizeReviewText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function contentFingerprint(title: string, pros?: string | null, cons?: string | null): string {
  const parts = [normalizeReviewText(title), normalizeReviewText(pros ?? ''), normalizeReviewText(cons ?? '')];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/** 3-gram (trigram) Jaccard similarity in [0, 1]. 1 = identical. */
export function textSimilarity(a: string, b: string): number {
  const grams = (text: string): Set<string> => {
    const t = normalizeReviewText(text);
    const set = new Set<string>();
    for (let i = 0; i <= t.length - 3; i += 1) {
      set.add(t.slice(i, i + 3));
    }
    return set;
  };

  const ga = grams(a);
  const gb = grams(b);

  if (ga.size === 0 && gb.size === 0) return 1;
  if (ga.size === 0 || gb.size === 0) return 0;

  let intersection = 0;
  for (const gram of ga) {
    if (gb.has(gram)) intersection += 1;
  }
  const union = ga.size + gb.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** Threshold above which two texts are considered near-duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.85;
