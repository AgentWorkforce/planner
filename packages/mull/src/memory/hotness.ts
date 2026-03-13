/**
 * Topic hotness scoring — ranks topics by combined frequency and recency.
 *
 * Inspired by OpenViking's hotness system. Combines two signals:
 * - Frequency: sigmoid on log1p(access_count), centered at ~6 accesses
 * - Recency: exponential decay with configurable half-life (default 7 days)
 *
 * Score range: 0.0 - 1.0
 */

/** Half-life in days for recency decay. After this many days, recency score halves. */
const HALF_LIFE_DAYS = 7;

/** Weight for recency vs frequency. Recency is more important for context relevance. */
const RECENCY_WEIGHT = 0.6;
const FREQUENCY_WEIGHT = 0.4;

/** Sigmoid center point — log1p(6) ≈ 1.95, so ~6 accesses = 0.5 frequency score. */
const SIGMOID_CENTER = Math.log1p(6);

/**
 * Compute a hotness score (0.0 - 1.0) for a topic based on access patterns.
 *
 * @param accessCount - Number of times this topic has been accessed/injected
 * @param lastAccessed - ISO timestamp of last access. If undefined, returns frequency-only score.
 * @param now - Current time in ms (defaults to Date.now(), injectable for testing)
 */
export function computeHotness(
  accessCount: number,
  lastAccessed?: string,
  now: number = Date.now(),
): number {
  // Frequency: sigmoid on log1p(accessCount)
  const frequency = 1 / (1 + Math.exp(-(Math.log1p(accessCount) - SIGMOID_CENTER)));

  // Recency: exponential decay
  if (!lastAccessed) {
    return frequency; // No recency data — use frequency only
  }

  const lastAccessedMs = new Date(lastAccessed).getTime();
  if (isNaN(lastAccessedMs)) {
    return frequency; // Invalid date — use frequency only
  }

  const daysSince = Math.max(0, (now - lastAccessedMs) / 86_400_000);
  const lambda = Math.LN2 / HALF_LIFE_DAYS;
  const recency = Math.exp(-lambda * daysSince);

  return FREQUENCY_WEIGHT * frequency + RECENCY_WEIGHT * recency;
}
