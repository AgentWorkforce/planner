/**
 * Demand scoring - computes demand scores from signals and cluster data.
 *
 * Pure function module with no storage dependencies.
 * Formula: demand_score = request_ratio * velocity_factor * quality_factor * 100
 */

import { z } from 'zod';

export const DemandScoreSchema = z.object({
  /** Composite demand score (0-100) */
  score: z.number(),
  /** Fraction of signals with actionable intent (0-1) */
  request_ratio: z.number(),
  /** Normalized weekly velocity, capped at 1.0 for 5+ signals/week (0-1) */
  velocity_factor: z.number(),
  /** Average signal quality score (0-1) */
  quality_factor: z.number(),
  /** Human-readable demand level */
  label: z.string(),
});

export type DemandScore = z.infer<typeof DemandScoreSchema>;

interface SignalLike {
  intent?: string | null;
  score: number;
}

interface ClusterLike {
  velocity_weekly: number;
  signal_count: number;
}

/** Intents that indicate actionable demand */
const ACTIONABLE_INTENTS = new Set(['feature_request', 'bug_report', 'question']);

/**
 * Compute demand score for a cluster based on its signals.
 *
 * Components:
 * - request_ratio: fraction of signals with intent = 'feature_request' | 'bug_report' | 'question'
 * - velocity_factor: min(velocity_weekly / 5, 1.0) — normalizes 5+ signals/week to max
 * - quality_factor: average signal score (0-1)
 *
 * @param signals Signals belonging to the cluster
 * @param cluster Cluster metadata (velocity, signal count)
 * @returns DemandScore with composite score, components, and label
 */
export function computeDemandScore(
  signals: SignalLike[],
  cluster: ClusterLike,
): DemandScore {
  if (signals.length === 0) {
    return { score: 0, request_ratio: 0, velocity_factor: 0, quality_factor: 0, label: 'low' };
  }

  const actionableCount = signals.filter(
    (s) => s.intent != null && ACTIONABLE_INTENTS.has(s.intent),
  ).length;
  const request_ratio = actionableCount / signals.length;

  const velocity_factor = Math.min(cluster.velocity_weekly / 5, 1.0);

  const quality_factor =
    signals.reduce((sum, s) => sum + s.score, 0) / signals.length;

  const score = Math.round(request_ratio * velocity_factor * quality_factor * 100);

  const label = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

  return { score, request_ratio, velocity_factor, quality_factor, label };
}
