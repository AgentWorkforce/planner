/**
 * Cultivate filters - Signal filtering functions
 */

import type { NormalizedEvent } from '../domain/types.js';
import type { Greenhouse } from '../storage/index.js';
import type { CultivateConfig, CultivateStorage } from '../types.js';
import { SignalFilteredError, type SignalMetadata } from '../errors.js';
import { applyGreenhouseGate } from './greenhouse-gate.js';
import { FilterRuleRegistry } from './rule-registry.js';

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

/**
 * Result of applying filters to a signal
 */
export interface ApplyFiltersResult {
  /** Whether signal passed all filters */
  passed: boolean;
  /** Accumulated score adjustments from boost rules */
  score_adjustments: number;
  /** Tier at which filtering occurred (0 or 1) - only present if passed */
  tier?: 0 | 1;
  /** Reason for passing (optional) */
  reason?: string;
}

/**
 * Apply unified two-tier filtering to a signal
 *
 * This is the pipeline-ready filter function that orchestrates:
 * - Tier 0: Greenhouse keyword gate (required/excluded keywords)
 * - Tier 1: Rule registry filters (reject/boost rules)
 *
 * Tier 0 runs first. If it rejects, Tier 1 is skipped entirely.
 * If both tiers pass, score adjustments from boost rules are accumulated.
 *
 * @param signal - Normalized event to filter
 * @param greenhouse - Greenhouse with keyword rules
 * @param config - Cultivate config with enabled rules and tier1_strictness
 * @param storage - Cultivate storage instance (for future extensibility)
 * @param registry - Filter rule registry with registered rules
 * @returns Result with passed=true and accumulated score adjustments
 * @throws SignalFilteredError with tier (0 or 1) and reason on rejection
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

  // Both tiers passed - return success with accumulated score adjustments
  return {
    passed: true,
    score_adjustments: tier1Result.score_adjustment,
  };
}
