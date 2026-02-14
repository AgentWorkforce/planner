/**
 * Signal scoring engine - combines factor calculations with weighted scoring
 */

import type { ScoringFactors, CultivateWeights } from '../domain/types.js';
import {
  calcRecency,
  calcSpecificity,
  calcSourceAuthority,
  calcRepetition,
  calcEmotionalIntensity,
  calcStrategicFit,
  calcActionability,
  calcContentQuality,
} from './factors.js';
import { resolveWeights, type WeightOptions } from './weights.js';

/**
 * Context required for calculating all scoring factors
 */
export interface ScoringContext {
  /**
   * When the signal occurred
   */
  signalTimestamp: Date;

  /**
   * Extraction result containing AI-analyzed factors
   */
  extractionResult: {
    specificity: number;
    emotional_intensity: number;
    actionability: number;
  };

  /**
   * Source tier classification (optional)
   */
  sourceTier?: string;

  /**
   * Number of signals in the cluster (optional, defaults to 1 for new signals)
   */
  clusterSignalCount?: number;

  /**
   * Keywords extracted from the signal
   */
  signalKeywords: string[];

  /**
   * Greenhouse focus keywords (optional)
   */
  greenhouseKeywords?: string[];

  /**
   * Signal title for content quality analysis
   */
  title: string;

  /**
   * Signal body text for content quality analysis
   */
  body: string;
}

/**
 * Scoring result with composite score, individual factors, and weights used
 */
export interface ScoringResult {
  /**
   * Weighted composite score (0-1)
   */
  score: number;

  /**
   * Individual factor scores (all 0-1)
   */
  factors: ScoringFactors;

  /**
   * Resolved weights used in calculation
   */
  weights: CultivateWeights;
}

/**
 * Calculate signal score using all 8 factors and resolved weights
 *
 * @param context Context containing all required data for scoring
 * @param weightOptions Optional weight overrides (greenhouse, tuner, mode)
 * @returns Scoring result with composite score, factors, and weights
 */
export function scoreSignal(
  context: ScoringContext,
  weightOptions?: WeightOptions
): ScoringResult {
  // Resolve weights with cascading priority
  const weights = resolveWeights(weightOptions);

  // Calculate all 8 factors
  const factors: ScoringFactors = {
    recency: calcRecency(context.signalTimestamp),
    specificity: calcSpecificity(context.extractionResult.specificity),
    source_authority: calcSourceAuthority(context.sourceTier),
    repetition: calcRepetition(context.clusterSignalCount ?? 1),
    emotional_intensity: calcEmotionalIntensity(context.extractionResult.emotional_intensity),
    strategic_fit: calcStrategicFit(
      context.signalKeywords,
      context.greenhouseKeywords ?? []
    ),
    actionability: calcActionability(context.extractionResult.actionability),
    content_quality: calcContentQuality(context.title, context.body),
  };

  // Calculate weighted composite score
  const score =
    factors.recency * weights.recency +
    factors.specificity * weights.specificity +
    factors.source_authority * weights.source_authority +
    factors.repetition * weights.repetition +
    factors.emotional_intensity * weights.emotional_intensity +
    factors.strategic_fit * weights.strategic_fit +
    factors.actionability * weights.actionability +
    factors.content_quality * weights.content_quality;

  // Clamp final score to [0, 1]
  const clampedScore = Math.max(0, Math.min(1, score));

  return {
    score: clampedScore,
    factors,
    weights,
  };
}
