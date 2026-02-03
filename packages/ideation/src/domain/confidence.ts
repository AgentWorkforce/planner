/**
 * Ideation Domain - Aggregate Confidence Computation
 *
 * Computes overall confidence from specialist observations.
 * Confidence is agent-reported (freeform), not schema-enforced.
 */

import type { Understanding } from './understanding.js';

// =============================================================================
// Confidence Computation
// =============================================================================

/**
 * Confidence level string to numeric value mapping.
 * Convention for aggregate computation - specialists can use any representation.
 */
const CONFIDENCE_VALUES: Record<string, number> = {
  exploring: 25,
  forming: 50,
  confident: 90,
};

/**
 * Breakdown of confidence by specialist.
 */
export interface ConfidenceBreakdown {
  [specialistName: string]: string | undefined;
}

/**
 * Result of aggregate confidence computation.
 */
export interface AggregateConfidenceResult {
  /** Overall score 0-100, average of all specialists */
  score: number;
  /** Per-specialist confidence levels */
  breakdown: ConfidenceBreakdown;
}

/**
 * Computes aggregate confidence from all specialist observations.
 *
 * Looks for 'confidence' key in each specialist's freeform observations.
 * Maps string values: 'exploring'->25, 'forming'->50, 'confident'->90
 * Returns average of all specialists, or 0 if none have reported.
 *
 * @param understanding - Freeform understanding from specialists
 * @returns Aggregate confidence score (0-100) and per-specialist breakdown
 */
export function computeAggregateConfidence(
  understanding: Understanding
): AggregateConfidenceResult {
  const breakdown: ConfidenceBreakdown = {};
  const scores: number[] = [];
  const validValues = Object.keys(CONFIDENCE_VALUES);

  for (const [specialistName, observations] of Object.entries(understanding)) {
    // Look for 'confidence' key in freeform observations
    const confidence = observations['confidence'];

    if (confidence === undefined) {
      // Specialist hasn't reported confidence - log warning
      console.warn(`[confidence] Specialist "${specialistName}" has no confidence field`);
      continue;
    }

    if (typeof confidence === 'string') {
      breakdown[specialistName] = confidence;

      // Map to numeric value using convention
      const value = CONFIDENCE_VALUES[confidence.toLowerCase()];
      if (value !== undefined) {
        scores.push(value);
      } else {
        // Malformed string value - log warning
        console.warn(
          `[confidence] Specialist "${specialistName}" has invalid confidence value "${confidence}". ` +
          `Expected one of: ${validValues.join(', ')}`
        );
      }
    } else if (typeof confidence === 'number') {
      // Direct numeric confidence (0-100)
      breakdown[specialistName] = String(confidence);
      scores.push(Math.max(0, Math.min(100, confidence)));
    } else {
      // Unexpected type
      console.warn(
        `[confidence] Specialist "${specialistName}" has confidence of unexpected type: ${typeof confidence}`
      );
    }
  }

  // Calculate average, or 0 if no specialists have reported
  const score = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return { score, breakdown };
}

/**
 * Returns the confidence level string for a given score.
 * Useful for UI display.
 */
export function getConfidenceLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 35) return 'low';
  if (score < 70) return 'medium';
  return 'high';
}
