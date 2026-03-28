import { z } from 'zod';

// ============================================
// Complexity Level
// ============================================

/**
 * Complexity levels for steps.
 * Research basis: P(success) = (0.5)^(T/50min) - decomposition is critical for reliability.
 */
export const ComplexityLevel = {
  Trivial: 'trivial',
  Simple: 'simple',
  Moderate: 'moderate',
  Complex: 'complex',
  VeryComplex: 'very_complex',
} as const;

export type ComplexityLevel = (typeof ComplexityLevel)[keyof typeof ComplexityLevel];

export const ComplexityLevelSchema = z.enum([
  'trivial',
  'simple',
  'moderate',
  'complex',
  'very_complex',
]);

// ============================================
// Complexity Recommendation
// ============================================

/**
 * Recommendations based on complexity score.
 */
export const ComplexityRecommendation = {
  Proceed: 'proceed',
  ConsiderDecomposition: 'consider_decomposition',
  RequireDecomposition: 'require_decomposition',
} as const;

export type ComplexityRecommendation =
  (typeof ComplexityRecommendation)[keyof typeof ComplexityRecommendation];

export const ComplexityRecommendationSchema = z.enum([
  'proceed',
  'consider_decomposition',
  'require_decomposition',
]);

// ============================================
// Complexity Signals
// ============================================

/**
 * Signals used to compute complexity score.
 * These are the raw inputs to the complexity formula.
 */
export const ComplexitySignalsSchema = z.object({
  /** Approximate token count from description (description.length / 4) */
  description_tokens: z.number().int().min(0),
  /** Number of scopes affected by this step */
  scope_count: z.number().int().min(0),
  /** Number of dependencies this step has */
  dependency_count: z.number().int().min(0),
  /** Number of acceptance criteria */
  ac_count: z.number().int().min(0),
  /** Bonus from complexity keywords (migration, refactor, security, etc.) */
  keyword_boost: z.number().int().min(0),
  /** Multiplier from language tier (1.0 for S, up to 5.0 for D) */
  language_multiplier: z.number().positive(),
  /** Historical average complexity for similar steps (optional, for Tuner integration) */
  historical_avg: z.number().optional(),
});

export type ComplexitySignals = z.infer<typeof ComplexitySignalsSchema>;

// ============================================
// Complexity Estimate
// ============================================

/**
 * Full complexity estimate for a step.
 * Computed by complexity-estimator service.
 */
export const ComplexityEstimateSchema = z.object({
  /** Categorized complexity level */
  level: ComplexityLevelSchema,
  /** Numeric score (0-100, higher = more complex) */
  score: z.number().min(0).max(100),
  /** Confidence in this estimate (0-1, higher = more confident) */
  confidence: z.number().min(0).max(1),
  /** Raw signals used to compute the score */
  signals: ComplexitySignalsSchema,
  /** Recommendation for how to proceed */
  recommendation: ComplexityRecommendationSchema,
});

export type ComplexityEstimate = z.infer<typeof ComplexityEstimateSchema>;

// ============================================
// Score Thresholds
// ============================================

/**
 * Thresholds for mapping score to complexity level.
 * Research-backed defaults.
 */
export const COMPLEXITY_LEVEL_THRESHOLDS = {
  trivial: 15,
  simple: 30,
  moderate: 50,
  complex: 75,
  // >= 75 is very_complex
} as const;

/**
 * Thresholds for mapping score to recommendation.
 */
export const COMPLEXITY_RECOMMENDATION_THRESHOLDS = {
  proceed: 30,
  consider_decomposition: 60,
  // >= 60 is require_decomposition
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Maps a complexity score to a complexity level.
 */
export function mapScoreToLevel(score: number): ComplexityLevel {
  if (score < COMPLEXITY_LEVEL_THRESHOLDS.trivial) return ComplexityLevel.Trivial;
  if (score < COMPLEXITY_LEVEL_THRESHOLDS.simple) return ComplexityLevel.Simple;
  if (score < COMPLEXITY_LEVEL_THRESHOLDS.moderate) return ComplexityLevel.Moderate;
  if (score < COMPLEXITY_LEVEL_THRESHOLDS.complex) return ComplexityLevel.Complex;
  return ComplexityLevel.VeryComplex;
}

/**
 * Maps a complexity score to a recommendation.
 */
export function mapScoreToRecommendation(score: number): ComplexityRecommendation {
  if (score < COMPLEXITY_RECOMMENDATION_THRESHOLDS.proceed) {
    return ComplexityRecommendation.Proceed;
  }
  if (score < COMPLEXITY_RECOMMENDATION_THRESHOLDS.consider_decomposition) {
    return ComplexityRecommendation.ConsiderDecomposition;
  }
  return ComplexityRecommendation.RequireDecomposition;
}
