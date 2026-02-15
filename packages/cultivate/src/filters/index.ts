/**
 * Cultivate filters - Signal filtering functions
 */

import type { NormalizedEvent } from '../domain/types.js';
import type { Greenhouse } from '../storage/index.js';
import type { CultivateConfig, CultivateStorage } from '../types.js';
import { SignalFilteredError, SignalProcessingError, type SignalMetadata } from '../errors.js';
import { applyGreenhouseGate } from './greenhouse-gate.js';
import { FilterRuleRegistry } from './rule-registry.js';
import { tier2Filter } from './ml-classifier.js';

// Re-export all filter components for direct use
export {
  applyGreenhouseGate,
  type GreenhouseGateSignal,
  type GreenhouseGateRules,
  type GreenhouseGateResult,
} from './greenhouse-gate.js';

export {
  FilterRuleRegistry,
  type FilterRuleFunction,
  type FilterRuleResult,
  type FilterRulesExecutionResult,
} from './rule-registry.js';

export {
  updateRuleEffectiveness,
  recalculateFalsePositiveRate,
} from './effectiveness.js';

export { registerDefaultRules } from './default-rules.js';

export {
  tier2Filter,
  type Tier2Result,
  type Tier2CategoryLabel,
} from './ml-classifier.js';

/**
 * Result of applying filters to a signal
 */
export interface ApplyFiltersResult {
  /** Whether signal passed all filters */
  passed: boolean;
  /** Accumulated score adjustments from boost rules */
  score_adjustments: number;
  /** Tier at which filtering occurred (0, 1, or 2) - only present if passed */
  tier?: 0 | 1 | 2;
  /** Reason for passing (optional) */
  reason?: string;
  /** Tier 2 ML classification score (0-1) - only present if tier2 enabled */
  tier2_score?: number;
  /** Tier 2 category hint - only present if tier2 enabled */
  tier2_category?: string;
}

/**
 * Apply unified three-tier filtering to a signal
 *
 * This is the pipeline-ready filter function that orchestrates:
 * - Tier 0: Greenhouse keyword gate (required/excluded keywords)
 * - Tier 1: Rule registry filters (reject/boost rules)
 * - Tier 2: ML classification (zero-shot classification for noise detection)
 *
 * Tiers run in sequence. If any tier rejects, subsequent tiers are skipped.
 * If all tiers pass, score adjustments from boost rules are accumulated.
 *
 * @param signal - Normalized event to filter
 * @param greenhouse - Greenhouse with keyword rules
 * @param config - Cultivate config with enabled rules, tier1_strictness, tier2 settings
 * @param storage - Cultivate storage instance (for future extensibility)
 * @param registry - Filter rule registry with registered rules
 * @returns Result with passed=true and accumulated score adjustments
 * @throws SignalFilteredError with tier (0, 1, or 2) and reason on rejection
 * @throws SignalProcessingError if ML model fails (dead-letter candidate)
 */
export async function applyFilters(
  signal: NormalizedEvent,
  greenhouse: Greenhouse,
  config: CultivateConfig,
  storage: CultivateStorage,
  registry: FilterRuleRegistry
): Promise<ApplyFiltersResult> {
  // Build signal metadata for error reporting
  const metadata: SignalMetadata = {
    source_type: signal.source_type,
    external_id: signal.external_id,
    greenhouse_id: greenhouse.id,
  };

  // ============================================================================
  // TIER 0: Greenhouse Gate (keyword filtering)
  // ============================================================================
  // This will throw SignalFilteredError(0, ...) on rejection
  applyGreenhouseGate(
    {
      title: signal.title,
      body: signal.body,
      source_type: signal.source_type,
      external_id: signal.external_id,
      greenhouse_id: greenhouse.id,
    },
    {
      keyword_require: greenhouse.keyword_require,
      keyword_exclude: greenhouse.keyword_exclude,
    }
  );

  // Tier 0 passed - continue to Tier 1

  // ============================================================================
  // TIER 1: Rule Registry (reject/boost rules)
  // ============================================================================

  // Get enabled rule IDs from config
  const enabledRuleIds = Object.entries(config.filter_rules)
    .filter(([_, rule]) => rule.enabled)
    .map(([id]) => id);

  // Execute enabled rules
  const tier1Result = registry.execute(signal, enabledRuleIds, {
    tier1_strictness: config.tier1_strictness,
  });

  // If Tier 1 rejected the signal, throw SignalFilteredError
  if (!tier1Result.passed) {
    throw new SignalFilteredError(
      1, // Tier 1
      tier1Result.rejection_reason || 'Signal rejected by Tier 1 filter',
      metadata,
      tier1Result.rejection_rule || ''
    );
  }

  // Tier 1 passed - check if Tier 2 is enabled

  // ============================================================================
  // TIER 2: ML Classification (zero-shot classification)
  // ============================================================================

  // Check if tier2 is enabled in config (default: false)
  const tier2Enabled = config.tier2_enabled ?? false;

  if (tier2Enabled) {
    try {
      // Concatenate title + body for ML classification
      const text = `${signal.title} ${signal.body}`;

      // Run ML classifier with configured threshold
      const tier2Result = await tier2Filter(text, config.tier2_threshold);

      // If Tier 2 rejected the signal, throw SignalFilteredError
      if (!tier2Result.passed) {
        throw new SignalFilteredError(
          2, // Tier 2
          `Signal classified as noise or low confidence (category: ${tier2Result.category_hint}, score: ${tier2Result.feedback_score.toFixed(2)})`,
          metadata,
          '' // No rule name for ML classification
        );
      }

      // Tier 2 passed - return success with tier2 metadata
      return {
        passed: true,
        score_adjustments: tier1Result.score_adjustment,
        tier2_score: tier2Result.feedback_score,
        tier2_category: tier2Result.category_hint,
      };
    } catch (err) {
      // If ML model throws (model not loaded, inference failure), wrap in SignalProcessingError
      // This routes to dead-letter without crashing the pipeline
      if (err instanceof SignalFilteredError) {
        // Re-throw filter rejections (expected path)
        throw err;
      }

      // Unexpected ML failure - route to dead-letter
      throw new SignalProcessingError(
        'tier2-classification',
        signal.external_id,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  // Tier 2 disabled or not reached - return success with accumulated score adjustments
  return {
    passed: true,
    score_adjustments: tier1Result.score_adjustment,
  };
}
