/**
 * In-memory token blocklist for revoked JWTs.
 *
 * Each entry stores the token's `jti` (JWT ID) claim and its expiry timestamp.
 * Expired entries are pruned automatically to bound memory usage.
 *
 * NOTE: For Vercel serverless with multiple instances, each instance has its
 * own copy of this Set, so a logout in one instance won't affect another.
 * For full production use, consider a Redis-backed solution. However, this
 * is still a significant improvement over the status quo (no invalidation at
 * all), and covers single-instance deployments and the common case where the
 * same serverless instance handles both login and subsequent requests.
 */

interface BlocklistEntry {
  expiresAt: number;
}

const blocklist = new Map<string, BlocklistEntry>();
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // prune every hour
let lastPrune = Date.now();

function prune(): void {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [jti, entry] of blocklist) {
    if (entry.expiresAt <= now) blocklist.delete(jti);
  }
}

export const tokenBlocklist = {
  /** Add a token's jti to the blocklist until its natural expiry. */
  revoke(jti: string, expiresAtMs: number): void {
    prune();
    blocklist.set(jti, { expiresAt: expiresAtMs });
  },

  /** Returns true if the jti has been revoked. */
  isRevoked(jti: string): boolean {
    prune();
    const entry = blocklist.get(jti);
    if (!entry) return false;
    // Entry exists but has expired — clean it up and treat as not revoked.
    if (entry.expiresAt <= Date.now()) {
      blocklist.delete(jti);
      return false;
    }
    return true;
  },
};
