/**
 * LLM batch trigger layer.
 *
 * Evaluates whether accumulated entities/facts should trigger an LLM
 * synthesis run. Trigger conditions (any one sufficient):
 *
 *   1. Entity count >= minEntitiesForLlm (default 3)
 *   2. Decision-type event received (immediate high-signal)
 *   3. Timer expired (~20 minutes since last LLM run)
 *   4. Session ended (flush remaining)
 */

import type { AccumulatorState, TriggerConfig } from './types.js';

// ---------------------------------------------------------------------------
// Trigger condition evaluation
// ---------------------------------------------------------------------------

export type LlmTriggerReason =
  | 'entity_threshold'
  | 'decision_event'
  | 'timer_expired'
  | 'session_end'
  | 'none';

/**
 * Evaluate whether the current accumulator state warrants an LLM batch run.
 *
 * @param state - Current accumulator state for this session
 * @param config - Trigger configuration thresholds
 * @param isDecisionEvent - Whether the triggering event is a decision-type
 * @param isSessionEnd - Whether the triggering event signals session end
 * @returns The reason for triggering, or 'none' if no trigger.
 */
export function evaluateLlmTrigger(
  state: AccumulatorState,
  config: TriggerConfig,
  isDecisionEvent: boolean,
  isSessionEnd: boolean,
): LlmTriggerReason {
  // Session end: flush everything remaining
  if (isSessionEnd) {
    const hasData = state.entitiesSinceLastLlm.length > 0 || state.factsSinceLastLlm.length > 0;
    return hasData ? 'session_end' : 'none';
  }

  // Decision events: immediate high-signal trigger (bypass threshold)
  if (isDecisionEvent) {
    return 'decision_event';
  }

  // Entity threshold: enough data accumulated
  if (state.entitiesSinceLastLlm.length >= config.minEntitiesForLlm) {
    return 'entity_threshold';
  }

  // Timer check: enough time since last LLM run
  if (state.lastLlmRunAt) {
    const elapsed = Date.now() - new Date(state.lastLlmRunAt).getTime();
    const hasData = state.entitiesSinceLastLlm.length > 0 || state.factsSinceLastLlm.length > 0;
    if (elapsed >= config.llmTimerIntervalMs && hasData) {
      return 'timer_expired';
    }
  }

  return 'none';
}

/**
 * Check if the timer has expired for a given session.
 * Used by the periodic timer to identify sessions that need flushing.
 */
export function isTimerExpired(
  state: AccumulatorState,
  intervalMs: number,
): boolean {
  const hasData = state.entitiesSinceLastLlm.length > 0 || state.factsSinceLastLlm.length > 0;
  if (!hasData) return false;

  if (!state.lastLlmRunAt && !state.lastDeterministicAt) {
    // Never ran — no basis for timer expiry. Wait for threshold.
    return false;
  }

  // Use the more recent of lastLlmRunAt and lastDeterministicAt as the reference.
  // This avoids re-triggering immediately after a deterministic run that didn't
  // produce enough entities for LLM.
  const refTime = state.lastLlmRunAt ?? state.lastDeterministicAt!;
  const elapsed = Date.now() - new Date(refTime).getTime();
  return elapsed >= intervalMs;
}
