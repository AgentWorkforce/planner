import { describe, it, expect } from 'vitest';
import { evaluateLlmTrigger, isTimerExpired } from './llm-batch.js';
import type { AccumulatorState, TriggerConfig } from './types.js';

function makeState(overrides: Partial<AccumulatorState> = {}): AccumulatorState {
  return {
    sessionId: 'test-session',
    entitiesSinceLastLlm: [],
    factsSinceLastLlm: [],
    lastLlmRunAt: null,
    lastDeterministicAt: null,
    ...overrides,
  };
}

const config: TriggerConfig = {
  minEntitiesForLlm: 3,
  llmTimerIntervalMs: 20 * 60 * 1000,
  mullDir: '.mull',
  memoryDir: './memory',
};

// ---------------------------------------------------------------------------
// evaluateLlmTrigger
// ---------------------------------------------------------------------------

describe('evaluateLlmTrigger', () => {
  it('returns "none" when no conditions are met', () => {
    const state = makeState({
      entitiesSinceLastLlm: [{ text: 'one', type: 'concept', count: 1 }],
    });
    expect(evaluateLlmTrigger(state, config, false, false)).toBe('none');
  });

  it('returns "entity_threshold" when enough entities accumulated', () => {
    const state = makeState({
      entitiesSinceLastLlm: [
        { text: 'a', type: 'person', count: 1 },
        { text: 'b', type: 'tool', count: 1 },
        { text: 'c', type: 'concept', count: 1 },
      ],
    });
    expect(evaluateLlmTrigger(state, config, false, false)).toBe('entity_threshold');
  });

  it('returns "decision_event" on decision-type events (bypasses threshold)', () => {
    const state = makeState({
      entitiesSinceLastLlm: [{ text: 'one', type: 'concept', count: 1 }],
    });
    expect(evaluateLlmTrigger(state, config, true, false)).toBe('decision_event');
  });

  it('returns "decision_event" even with empty accumulator', () => {
    const state = makeState();
    expect(evaluateLlmTrigger(state, config, true, false)).toBe('decision_event');
  });

  it('returns "session_end" when session ends with pending data', () => {
    const state = makeState({
      entitiesSinceLastLlm: [{ text: 'one', type: 'concept', count: 1 }],
    });
    expect(evaluateLlmTrigger(state, config, false, true)).toBe('session_end');
  });

  it('returns "none" when session ends with no pending data', () => {
    const state = makeState();
    expect(evaluateLlmTrigger(state, config, false, true)).toBe('none');
  });

  it('session_end takes priority over decision_event', () => {
    const state = makeState({
      factsSinceLastLlm: [{ slug: 'f', text: 'fact', entities: [] }],
    });
    expect(evaluateLlmTrigger(state, config, true, true)).toBe('session_end');
  });

  it('returns "timer_expired" when enough time has passed and data exists', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const state = makeState({
      lastLlmRunAt: thirtyMinAgo,
      entitiesSinceLastLlm: [{ text: 'one', type: 'concept', count: 1 }],
    });
    expect(evaluateLlmTrigger(state, config, false, false)).toBe('timer_expired');
  });

  it('does not trigger timer when no data accumulated', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const state = makeState({
      lastLlmRunAt: thirtyMinAgo,
    });
    expect(evaluateLlmTrigger(state, config, false, false)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// isTimerExpired
// ---------------------------------------------------------------------------

describe('isTimerExpired', () => {
  it('returns false when no data accumulated', () => {
    const state = makeState({
      lastLlmRunAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    });
    expect(isTimerExpired(state, config.llmTimerIntervalMs)).toBe(false);
  });

  it('returns false when never ran (no reference timestamp)', () => {
    const state = makeState({
      entitiesSinceLastLlm: [{ text: 'a', type: 'concept', count: 1 }],
    });
    expect(isTimerExpired(state, config.llmTimerIntervalMs)).toBe(false);
  });

  it('returns true when interval exceeded with data', () => {
    const state = makeState({
      lastLlmRunAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      entitiesSinceLastLlm: [{ text: 'a', type: 'concept', count: 1 }],
    });
    expect(isTimerExpired(state, config.llmTimerIntervalMs)).toBe(true);
  });

  it('returns false when interval not yet exceeded', () => {
    const state = makeState({
      lastLlmRunAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      entitiesSinceLastLlm: [{ text: 'a', type: 'concept', count: 1 }],
    });
    expect(isTimerExpired(state, config.llmTimerIntervalMs)).toBe(false);
  });

  it('uses lastDeterministicAt as fallback when lastLlmRunAt is null', () => {
    const state = makeState({
      lastDeterministicAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      entitiesSinceLastLlm: [{ text: 'a', type: 'concept', count: 1 }],
    });
    expect(isTimerExpired(state, config.llmTimerIntervalMs)).toBe(true);
  });
});
