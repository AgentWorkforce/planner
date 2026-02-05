import type { RunResult } from '../runner/types.js';

/**
 * Calculate Pearson correlation between estimated complexity and actual time.
 * Returns r in [-1, 1], or null if insufficient data.
 *
 * r = Σ((x-x̄)(y-ȳ)) / √(Σ(x-x̄)² × Σ(y-ȳ)²)
 */
export function calculateComplexityAccuracy(results: RunResult[]): number | null {
  // Filter to results that have both estimated complexity and actual time
  // Include complexity >= 0 (zero-complexity tasks are valid)
  const pairs = results
    .filter((r) => r.estimated_complexity !== undefined && r.estimated_complexity >= 0)
    .map((r) => ({
      x: r.estimated_complexity!,
      y: r.actual_time_seconds,
    }));

  if (pairs.length < 2) {
    console.warn(`[Metrics] Complexity correlation: insufficient data (${pairs.length} samples, need at least 2)`);
    return null;
  }

  const n = pairs.length;
  const meanX = pairs.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = pairs.reduce((sum, p) => sum + p.y, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const { x, y } of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);

  if (denominator === 0) {
    console.warn('[Metrics] Complexity correlation: no variance in data (all values identical)');
    return null;
  }

  return sumXY / denominator;
}
