/**
 * Filter rule registry for Tier 1 signal filtering
 *
 * Manages a registry of filter rules that can be applied to signals
 * before extraction and scoring. Rules can reject signals or boost
 * their scores based on configurable criteria.
 */

import type { NormalizedEvent } from '../domain/types.js';

/**
 * Result of applying a filter rule to a signal
 */
export type FilterRuleResult = {
  /** Action to take: pass (no action), reject (filter out), or boost (adjust score) */
  action: 'pass' | 'reject' | 'boost';
  /** Optional score adjustment for boost actions (positive or negative) */
  score_adjustment?: number;
  /** Optional human-readable reason for the action */
  reason?: string;
};

/**
 * Filter rule function type
 *
 * @param signal - Normalized event to filter
 * @param config - Configuration with tier1_strictness parameter
 * @returns FilterRuleResult indicating the action to take
 */
export type FilterRuleFunction = (
  signal: NormalizedEvent,
  config: { tier1_strictness: number }
) => FilterRuleResult;

/**
 * Internal rule metadata stored in registry
 */
interface FilterRuleEntry {
  id: string;
  name: string;
  description: string;
  type: 'reject' | 'boost';
  fn: FilterRuleFunction;
}

/**
 * Aggregated result from executing multiple filter rules
 */
export interface FilterRulesExecutionResult {
  /** Whether the signal passed all filters */
  passed: boolean;
  /** Total accumulated score adjustment from boost rules */
  score_adjustment: number;
  /** Rejection reason if signal was rejected */
  rejection_reason?: string;
  /** Name of the rule that caused rejection */
  rejection_rule?: string;
}

/**
 * Filter rule registry
 *
 * Manages registration and execution of filter rules for Tier 1 filtering.
 * Rules are stored by ID and can be selectively enabled for execution.
 *
 * Key behaviors:
 * - A single 'reject' action from any enabled rule causes signal rejection
 * - Boost actions accumulate score adjustments
 * - Rules execute in order until a rejection occurs (short-circuit)
 */
export class FilterRuleRegistry {
  private rules: Map<string, FilterRuleEntry> = new Map();

  /**
   * Register a new filter rule
   *
   * @param id - Unique identifier for the rule
   * @param name - Human-readable name
   * @param description - Description of what the rule does
   * @param type - Rule type: 'reject' or 'boost'
   * @param fn - Function that implements the rule logic
   */
  register(
    id: string,
    name: string,
    description: string,
    type: 'reject' | 'boost',
    fn: FilterRuleFunction
  ): void {
    this.rules.set(id, { id, name, description, type, fn });
  }

  /**
   * Get a rule by ID
   *
   * @param id - Rule identifier
   * @returns Rule entry or undefined if not found
   */
  get(id: string): FilterRuleEntry | undefined {
    return this.rules.get(id);
  }

  /**
   * List all registered rules
   *
   * @returns Array of all rule entries
   */
  list(): FilterRuleEntry[] {
    return Array.from(this.rules.values());
  }

  /**
   * Execute enabled filter rules on a signal
   *
   * Rules execute in order until:
   * - A rule returns action='reject' (short-circuits with rejection)
   * - All enabled rules complete (returns aggregated result)
   *
   * @param signal - Normalized event to filter
   * @param enabledRuleIds - Array of rule IDs to execute
   * @param config - Configuration with tier1_strictness parameter
   * @returns Aggregated execution result with pass/reject status and score adjustments
   */
  execute(
    signal: NormalizedEvent,
    enabledRuleIds: string[],
    config: { tier1_strictness: number }
  ): FilterRulesExecutionResult {
    let totalScoreAdjustment = 0;

    // Execute only enabled rules
    for (const ruleId of enabledRuleIds) {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        console.warn(`[cultivate:rule-registry] Rule ${ruleId} not found, skipping`);
        continue;
      }

      // Execute the rule function
      const result = rule.fn(signal, config);

      // Short-circuit on rejection
      if (result.action === 'reject') {
        return {
          passed: false,
          score_adjustment: 0,
          rejection_reason: result.reason || 'Signal rejected by filter rule',
          rejection_rule: rule.name,
        };
      }

      // Accumulate boost score adjustments
      if (result.action === 'boost' && result.score_adjustment !== undefined) {
        totalScoreAdjustment += result.score_adjustment;
      }
    }

    // All rules passed
    return {
      passed: true,
      score_adjustment: totalScoreAdjustment,
    };
  }
}
