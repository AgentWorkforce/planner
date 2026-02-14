/**
 * Filter rule effectiveness tracking
 *
 * Tracks how well filter rules perform by:
 * - Counting signals matched by each rule
 * - Computing false positive rates (signals rejected but later re-admitted)
 */

import type { CultivateStorage } from '../storage/interface.js';

/**
 * Update effectiveness metrics after a rule evaluation
 *
 * Increments signals_matched count for the rule when it matches a signal
 * (regardless of whether it rejects or boosts).
 *
 * @param storage - Storage instance
 * @param ruleId - Rule identifier
 * @param matched - Whether the rule matched/evaluated the signal
 */
export async function updateRuleEffectiveness(
  storage: CultivateStorage,
  ruleId: string,
  matched: boolean
): Promise<void> {
  if (!matched) return;

  // Get current effectiveness metrics
  const rule = await storage.getFilterRuleById(ruleId);
  if (!rule) {
    console.warn(`[cultivate:effectiveness] Rule ${ruleId} not found, skipping effectiveness update`);
    return;
  }

  // Increment signals_matched count
  const updatedEffectiveness = {
    signals_matched: rule.effectiveness.signals_matched + 1,
    false_positive_rate: rule.effectiveness.false_positive_rate,
  };

  await storage.updateFilterEffectiveness(ruleId, updatedEffectiveness);
}

/**
 * Recalculate false positive rate for a rule
 *
 * Queries signal outcomes to compute the rate of signals that were:
 * - Rejected by this rule (filtered out)
 * - Later manually re-admitted or linked to a plan
 *
 * This is computed lazily, not in real-time, as it requires querying
 * historical signal outcomes.
 *
 * @param storage - Storage instance
 * @param ruleId - Rule identifier
 * @returns Updated false positive rate (0-1)
 */
export async function recalculateFalsePositiveRate(
  storage: CultivateStorage,
  ruleId: string
): Promise<number> {
  // Verify rule exists
  const rule = await storage.getFilterRuleById(ruleId);
  if (!rule) {
    console.warn(`[cultivate:effectiveness] Rule ${ruleId} not found, skipping FPR recalculation`);
    return 0;
  }

  // Query all filtered signals (paginated query, 1000 at a time)
  // We need to check provenance to find signals rejected by this specific rule
  const limit = 1000;
  let offset = 0;
  let totalRejectedByRule = 0;
  let falsePositives = 0;
  let hasMore = true;

  while (hasMore) {
    const filteredSignals = await storage.listSignals({
      status: 'filtered',
      limit,
      offset,
    });

    if (filteredSignals.length === 0) {
      hasMore = false;
      break;
    }

    // Check each signal's provenance to see if it was rejected by this rule
    for (const signal of filteredSignals) {
      // provenance is an array of StepProvenance objects
      // Look for a 'filter' step with rejection_rule in details
      const filterStep = signal.provenance.find(
        (step) =>
          step.step === 'filter' &&
          step.details?.rejection_rule === ruleId
      );

      if (filterStep) {
        // This signal was rejected by this rule
        totalRejectedByRule++;

        // Check if it was later linked to a plan (false positive)
        if (signal.linked_plan_id) {
          falsePositives++;
        }
      }
    }

    // Move to next page
    offset += limit;
    if (filteredSignals.length < limit) {
      hasMore = false;
    }
  }

  // Calculate false positive rate
  if (totalRejectedByRule === 0) {
    // No rejections by this rule yet, rate is 0
    return 0;
  }

  const falsePositiveRate = falsePositives / totalRejectedByRule;

  // Update the rule's effectiveness metrics with the new FPR
  await storage.updateFilterEffectiveness(ruleId, {
    signals_matched: rule.effectiveness.signals_matched,
    false_positive_rate: falsePositiveRate,
  });

  return falsePositiveRate;
}
