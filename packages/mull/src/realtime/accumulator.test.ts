import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadAccumulatorState,
  saveAccumulatorState,
  accumulateEntities,
  markLlmRunComplete,
  readAccumulatorState,
} from './accumulator.js';
import type { AccumulatorState } from './types.js';

let mullDir: string;

beforeEach(() => {
  mullDir = mkdtempSync(join(tmpdir(), 'mull-acc-test-'));
});

// ---------------------------------------------------------------------------
// loadAccumulatorState
// ---------------------------------------------------------------------------

describe('loadAccumulatorState', () => {
  it('returns fresh state when no file exists', () => {
    const state = loadAccumulatorState(mullDir, 'test-session');
    expect(state.sessionId).toBe('test-session');
    expect(state.entitiesSinceLastLlm).toEqual([]);
    expect(state.factsSinceLastLlm).toEqual([]);
    expect(state.lastLlmRunAt).toBeNull();
    expect(state.lastDeterministicAt).toBeNull();
  });

  it('round-trips through save and load', () => {
    const state: AccumulatorState = {
      sessionId: 'test-session',
      entitiesSinceLastLlm: [{ text: 'agent-1', type: 'person', count: 1 }],
      factsSinceLastLlm: [{ slug: 'f-1', text: 'a fact', entities: [] }],
      lastLlmRunAt: '2026-01-01T00:00:00.000Z',
      lastDeterministicAt: '2026-01-01T00:01:00.000Z',
    };
    saveAccumulatorState(mullDir, state);
    const loaded = loadAccumulatorState(mullDir, 'test-session');
    expect(loaded).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// accumulateEntities
// ---------------------------------------------------------------------------

describe('accumulateEntities', () => {
  it('adds entities and facts to accumulator', async () => {
    const entities = [{ text: 'agent-1', type: 'person' as const, count: 1 }];
    const facts = [{ slug: 'f-1', text: 'test fact', entities: [] }];

    const state = await accumulateEntities(mullDir, 'sess-1', entities, facts);
    expect(state.entitiesSinceLastLlm).toHaveLength(1);
    expect(state.factsSinceLastLlm).toHaveLength(1);
    expect(state.lastDeterministicAt).toBeTruthy();
  });

  it('accumulates across multiple calls', async () => {
    const e1 = [{ text: 'agent-1', type: 'person' as const, count: 1 }];
    const e2 = [{ text: 'agent-2', type: 'person' as const, count: 1 }];

    await accumulateEntities(mullDir, 'sess-1', e1, []);
    const state = await accumulateEntities(mullDir, 'sess-1', e2, []);
    expect(state.entitiesSinceLastLlm).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// markLlmRunComplete
// ---------------------------------------------------------------------------

describe('markLlmRunComplete', () => {
  it('clears accumulated entities and facts', async () => {
    // Accumulate some data first
    await accumulateEntities(
      mullDir,
      'sess-1',
      [{ text: 'agent-1', type: 'person', count: 1 }],
      [{ slug: 'f-1', text: 'fact', entities: [] }],
    );

    const state = await markLlmRunComplete(mullDir, 'sess-1');
    expect(state.entitiesSinceLastLlm).toEqual([]);
    expect(state.factsSinceLastLlm).toEqual([]);
    expect(state.lastLlmRunAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// readAccumulatorState
// ---------------------------------------------------------------------------

describe('readAccumulatorState', () => {
  it('reads state without modifying it', async () => {
    await accumulateEntities(
      mullDir,
      'sess-1',
      [{ text: 'agent-1', type: 'person', count: 1 }],
      [],
    );

    const state = await readAccumulatorState(mullDir, 'sess-1');
    expect(state.entitiesSinceLastLlm).toHaveLength(1);

    // Read again — still the same
    const state2 = await readAccumulatorState(mullDir, 'sess-1');
    expect(state2.entitiesSinceLastLlm).toHaveLength(1);
  });
});
