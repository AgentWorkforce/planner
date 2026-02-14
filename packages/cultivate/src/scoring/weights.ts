/**
 * Scoring weight resolution with cascading defaults
 */

import type { CultivateWeights } from '../domain/types.js';

/**
 * Balanced baseline weights that sum to 1.0
 * These provide a reasonable starting point for most use cases
 */
export const DEFAULT_WEIGHTS: CultivateWeights = {
  recency: 0.15,
  specificity: 0.15,
  source_authority: 0.10,
  repetition: 0.10,
  emotional_intensity: 0.10,
  strategic_fit: 0.20,
  actionability: 0.15,
  content_quality: 0.05,
};

/**
 * Options for weight resolution with priority chain
 */
export interface WeightOptions {
  /**
   * Greenhouse-specific weight overrides (highest priority)
   */
  greenhouseOverrides?: Partial<CultivateWeights>;

  /**
   * Tuner-recommended weights (second priority)
   */
  tunerWeights?: Partial<CultivateWeights>;

  /**
   * Mode-specific defaults (third priority)
   */
  modeDefaults?: Partial<CultivateWeights>;
}

/**
 * Resolve weights with cascading priority chain:
 * greenhouseOverrides > tunerWeights > modeDefaults > DEFAULT_WEIGHTS
 *
 * Partial overrides merge - missing factors fall through to next level.
 *
 * @param options Weight override options
 * @returns Resolved weights with all 8 factors defined
 */
export function resolveWeights(options: WeightOptions = {}): CultivateWeights {
  const { greenhouseOverrides, tunerWeights, modeDefaults } = options;

  return {
    recency:
      greenhouseOverrides?.recency ??
      tunerWeights?.recency ??
      modeDefaults?.recency ??
      DEFAULT_WEIGHTS.recency,
    specificity:
      greenhouseOverrides?.specificity ??
      tunerWeights?.specificity ??
      modeDefaults?.specificity ??
      DEFAULT_WEIGHTS.specificity,
    source_authority:
      greenhouseOverrides?.source_authority ??
      tunerWeights?.source_authority ??
      modeDefaults?.source_authority ??
      DEFAULT_WEIGHTS.source_authority,
    repetition:
      greenhouseOverrides?.repetition ??
      tunerWeights?.repetition ??
      modeDefaults?.repetition ??
      DEFAULT_WEIGHTS.repetition,
    emotional_intensity:
      greenhouseOverrides?.emotional_intensity ??
      tunerWeights?.emotional_intensity ??
      modeDefaults?.emotional_intensity ??
      DEFAULT_WEIGHTS.emotional_intensity,
    strategic_fit:
      greenhouseOverrides?.strategic_fit ??
      tunerWeights?.strategic_fit ??
      modeDefaults?.strategic_fit ??
      DEFAULT_WEIGHTS.strategic_fit,
    actionability:
      greenhouseOverrides?.actionability ??
      tunerWeights?.actionability ??
      modeDefaults?.actionability ??
      DEFAULT_WEIGHTS.actionability,
    content_quality:
      greenhouseOverrides?.content_quality ??
      tunerWeights?.content_quality ??
      modeDefaults?.content_quality ??
      DEFAULT_WEIGHTS.content_quality,
  };
}
