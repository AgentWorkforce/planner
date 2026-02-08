import type { Step } from '../domain/step.js';
import {
  ComplexityEstimate,
  ComplexitySignals,
  ComplexityLevel,
  ComplexityRecommendation,
  mapScoreToLevel,
  mapScoreToRecommendation,
} from '../domain/complexity.js';
import { getTierMultiplier, LanguageTier } from '../domain/language-tier.js';
import type { PlannerConfig, ComplexityWeights } from '../tuner/config.js';
import { DEFAULT_PLANNER_CONFIG } from '../tuner/config.js';

// ============================================
// Constants
// ============================================

/**
 * Keywords that indicate higher complexity.
 * Each keyword adds +1 to keyword_boost.
 */
export const COMPLEXITY_KEYWORDS = [
  'migration',
  'refactor',
  'refactoring',
  'security',
  'performance',
  'integration',
  'concurrent',
  'concurrency',
  'async',
  'parallel',
  'distributed',
  'scale',
  'scaling',
  'architecture',
  'legacy',
  'authentication',
  'authorization',
  'encryption',
  'database',
  'schema',
  'api',
  'breaking',
  'backwards',
  'compatibility',
] as const;

/**
 * Approximate tokens per character ratio.
 * Research: ~4 characters per token on average for English text.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Normalization factor for description tokens.
 * Score contribution = (tokens / DESCRIPTION_TOKEN_DIVISOR) * description_weight
 */
const DESCRIPTION_TOKEN_DIVISOR = 500;

// ============================================
// Helper Functions
// ============================================

/**
 * Estimates the token count from text length.
 * Uses ~4 characters per token approximation.
 */
export function countTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Detects complexity keywords in text.
 * Returns the count of unique keywords found.
 */
export function detectComplexityKeywords(text: string): number {
  if (!text) return 0;

  const lowerText = text.toLowerCase();
  let count = 0;

  for (const keyword of COMPLEXITY_KEYWORDS) {
    // Use word boundary matching for accuracy
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerText)) {
      count++;
    }
  }

  return count;
}

/**
 * Gets the keywords found in text (for debugging).
 */
export function getFoundKeywords(text: string): string[] {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const keyword of COMPLEXITY_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerText)) {
      found.push(keyword);
    }
  }

  return found;
}

/**
 * Counts unique scopes from a step.
 * Scope field may contain comma-separated values.
 */
export function countScopes(step: Step): number {
  if (!step.scope) return 0;

  const scopes = step.scope.split(',').map((s) => s.trim()).filter(Boolean);
  return new Set(scopes).size || 1;
}

// ============================================
// Main Estimation Function
// ============================================

export interface EstimateComplexityOptions {
  /** Configuration from Tuner (uses defaults if not provided) */
  config?: PlannerConfig;
  /** Override language tier (uses step.language_tier if not provided) */
  languageTier?: LanguageTier;
  /** Historical average complexity for similar steps (optional) */
  historicalAvg?: number;
}

/**
 * Estimates the complexity of a step using a deterministic formula.
 *
 * Formula:
 *   baseScore = (descTokens / 500) * description_weight
 *             + scopeCount * scope_weight
 *             + depCount * dependency_weight
 *             + acCount * ac_weight
 *             + keywordBoost * keyword_weight
 *
 *   finalScore = baseScore * languageMultiplier
 *
 * Research basis:
 * - METR 2025: P(success) = (0.5)^(T/50min) - smaller tasks succeed more
 * - Keyword indicators correlate with task complexity
 * - Language tiers create significant accuracy gaps
 */
export function estimateComplexity(
  step: Step,
  options: EstimateComplexityOptions = {}
): ComplexityEstimate {
  const config = options.config ?? DEFAULT_PLANNER_CONFIG;
  const weights = config.complexity_weights;

  // Extract signals from step
  const descriptionText = [step.title, step.description ?? ''].join(' ');
  const descriptionTokens = countTokens(descriptionText);
  const scopeCount = countScopes(step);
  const dependencyCount = step.dependencies?.length ?? 0;
  const acCount = step.acceptance_criteria?.length ?? 0;
  const keywordBoost = detectComplexityKeywords(descriptionText);

  // Determine language tier and multiplier
  const tier = options.languageTier ?? step.language_tier ?? 'a';
  const languageMultiplier = getTierMultiplier(tier);

  // Calculate base score
  const descriptionScore =
    (descriptionTokens / DESCRIPTION_TOKEN_DIVISOR) * weights.description_weight;
  const scopeScore = scopeCount * weights.scope_weight;
  const depScore = dependencyCount * weights.dependency_weight;
  const acScore = acCount * weights.ac_weight;
  const keywordScore = keywordBoost * weights.keyword_weight;

  const baseScore = descriptionScore + scopeScore + depScore + acScore + keywordScore;

  // Apply language multiplier
  const rawScore = baseScore * languageMultiplier;

  // Clamp to 0-100 range
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Build signals object
  const signals: ComplexitySignals = {
    description_tokens: descriptionTokens,
    scope_count: scopeCount,
    dependency_count: dependencyCount,
    ac_count: acCount,
    keyword_boost: keywordBoost,
    language_multiplier: languageMultiplier,
    ...(options.historicalAvg !== undefined && { historical_avg: options.historicalAvg }),
  };

  // Determine level and recommendation
  const level = mapScoreToLevel(finalScore);
  const recommendation = mapScoreToRecommendation(finalScore);

  // Confidence: lower without historical data
  const confidence = options.historicalAvg !== undefined ? 0.8 : 0.5;

  return {
    level,
    score: finalScore,
    confidence,
    signals,
    recommendation,
  };
}

// ============================================
// Batch Estimation
// ============================================

/**
 * Estimates complexity for multiple steps.
 */
export function estimateComplexityBatch(
  steps: Step[],
  options: EstimateComplexityOptions = {}
): Map<string, ComplexityEstimate> {
  const results = new Map<string, ComplexityEstimate>();

  for (const step of steps) {
    results.set(step.step_id, estimateComplexity(step, options));
  }

  return results;
}

/**
 * Enriches steps with complexity estimates (mutates steps).
 * Only adds estimate if step doesn't already have one (respects manual overrides).
 */
export function enrichStepsWithComplexity(
  steps: Step[],
  options: EstimateComplexityOptions = {}
): Step[] {
  return steps.map((step) => {
    if (step.complexity_estimate) {
      // Already has estimate, skip (manual override)
      return step;
    }

    return {
      ...step,
      complexity_estimate: estimateComplexity(step, options),
    };
  });
}

// ============================================
// Analysis Helpers
// ============================================

/**
 * Summarizes complexity across a set of steps.
 */
export interface ComplexitySummary {
  totalSteps: number;
  byLevel: Record<ComplexityLevel, number>;
  averageScore: number;
  maxScore: number;
  stepsRequiringDecomposition: string[];
  stepsConsideringDecomposition: string[];
}

export function summarizeComplexity(steps: Step[]): ComplexitySummary {
  const byLevel: Record<ComplexityLevel, number> = {
    trivial: 0,
    simple: 0,
    moderate: 0,
    complex: 0,
    very_complex: 0,
  };

  let totalScore = 0;
  let maxScore = 0;
  const stepsRequiringDecomposition: string[] = [];
  const stepsConsideringDecomposition: string[] = [];

  for (const step of steps) {
    const estimate = step.complexity_estimate ?? estimateComplexity(step);
    byLevel[estimate.level]++;
    totalScore += estimate.score;
    maxScore = Math.max(maxScore, estimate.score);

    if (estimate.recommendation === 'require_decomposition') {
      stepsRequiringDecomposition.push(step.step_id);
    } else if (estimate.recommendation === 'consider_decomposition') {
      stepsConsideringDecomposition.push(step.step_id);
    }
  }

  return {
    totalSteps: steps.length,
    byLevel,
    averageScore: steps.length > 0 ? Math.round(totalScore / steps.length) : 0,
    maxScore,
    stepsRequiringDecomposition,
    stepsConsideringDecomposition,
  };
}
