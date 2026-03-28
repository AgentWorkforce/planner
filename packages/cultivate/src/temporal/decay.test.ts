/**
 * Tests for DecayEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecayEngine } from './decay.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { Signal } from '../domain/types.js';

// Mock storage
const createMockStorage = (): CultivateStorage => {
  const signals: Signal[] = [
    {
      id: 'sig-1',
      greenhouse_id: 'gh-1',
      score: 0.8,
      status: 'clustered' as const,
      created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days ago
      linked_plan_id: undefined,
    } as Signal,
    {
      id: 'sig-2',
      greenhouse_id: 'gh-1',
      score: 0.5,
      status: 'clustered' as const,
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
      linked_plan_id: undefined,
    } as Signal,
    {
      id: 'sig-3',
      greenhouse_id: 'gh-1',
      score: 0.9,
      status: 'clustered' as const,
      created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days ago
      linked_plan_id: 'plan-1', // Linked to plan, should be exempt
    } as Signal,
    {
      id: 'sig-4',
      greenhouse_id: 'gh-1',
      score: 0.3,
      status: 'decayed' as const, // Already decayed, should be skipped
      created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      linked_plan_id: undefined,
    } as Signal,
  ];

  const updates: Array<{ id: string; score?: number; status?: string }> = [];

  return {
    listSignals: vi.fn(async () => signals),
    updateSignal: vi.fn(async (id, input) => {
      updates.push({ id, ...input });
      const signal = signals.find(s => s.id === id);
      if (!signal) throw new Error('Signal not found');
      return {
        ...signal,
        ...input,
      };
    }),
    _updates: updates,
  } as any;
};

describe('DecayEngine', () => {
  let engine: DecayEngine;
  let mockStorage: CultivateStorage & { _updates: any[] };

  beforeEach(() => {
    mockStorage = createMockStorage() as any;
    engine = new DecayEngine(mockStorage);
  });

  it('should apply exponential decay formula correctly', async () => {
    await engine.applyDecay('gh-1', 90, 0.15, true);

    const updates = (mockStorage as any)._updates;

    // sig-1: 180 days old, score 0.8
    // decay_factor = 0.5 ^ (180 / 90) = 0.5 ^ 2 = 0.25
    // new_score = 0.8 * 0.25 = 0.2
    const sig1Update = updates.find((u: any) => u.id === 'sig-1');
    expect(sig1Update).toBeDefined();
    expect(sig1Update.score).toBeCloseTo(0.2, 2);

    // sig-2: 90 days old, score 0.5
    // decay_factor = 0.5 ^ (90 / 90) = 0.5 ^ 1 = 0.5
    // new_score = 0.5 * 0.5 = 0.25
    const sig2Update = updates.find((u: any) => u.id === 'sig-2');
    expect(sig2Update).toBeDefined();
    expect(sig2Update.score).toBeCloseTo(0.25, 2);
  });

  it('should mark signals below threshold as decayed', async () => {
    const result = await engine.applyDecay('gh-1', 90, 0.15, true);

    const updates = (mockStorage as any)._updates;

    // sig-1: new_score = 0.2 (above threshold 0.15, should not be marked decayed)
    const sig1Update = updates.find((u: any) => u.id === 'sig-1');
    expect(sig1Update.status).toBe('clustered'); // Original status preserved

    // sig-2: new_score = 0.25 (above threshold 0.15, should not be marked decayed)
    const sig2Update = updates.find((u: any) => u.id === 'sig-2');
    expect(sig2Update.status).toBe('clustered');

    // Adjust threshold to mark sig-1 as decayed
    // Create new storage instance to reset state
    const mockStorage2 = createMockStorage() as any;
    const engine2 = new DecayEngine(mockStorage2);

    await engine2.applyDecay('gh-1', 90, 0.21, true); // threshold 0.21 > 0.2

    const updates2 = mockStorage2._updates;
    const sig1Update2 = updates2.find((u: any) => u.id === 'sig-1');
    expect(sig1Update2).toBeDefined();
    expect(sig1Update2.status).toBe('decayed');
  });

  it('should exempt linked signals from decay', async () => {
    await engine.applyDecay('gh-1', 90, 0.15, true);

    const updates = (mockStorage as any)._updates;

    // sig-3: has linked_plan_id, should not be updated
    const sig3Update = updates.find((u: any) => u.id === 'sig-3');
    expect(sig3Update).toBeUndefined();
  });

  it('should not exempt linked signals when linkedExempt is false', async () => {
    await engine.applyDecay('gh-1', 90, 0.15, false);

    const updates = (mockStorage as any)._updates;

    // sig-3: has linked_plan_id, but linkedExempt=false, should be updated
    const sig3Update = updates.find((u: any) => u.id === 'sig-3');
    expect(sig3Update).toBeDefined();
  });

  it('should skip already decayed signals', async () => {
    await engine.applyDecay('gh-1', 90, 0.15, true);

    const updates = (mockStorage as any)._updates;

    // sig-4: already decayed, should not be updated
    const sig4Update = updates.find((u: any) => u.id === 'sig-4');
    expect(sig4Update).toBeUndefined();
  });

  it('should return correct counts', async () => {
    const result = await engine.applyDecay('gh-1', 90, 0.15, true);

    // sig-1 and sig-2 should be updated (sig-3 linked, sig-4 already decayed)
    expect(result.updated).toBe(2);

    // None should be newly marked as decayed with threshold 0.15
    expect(result.decayed).toBe(0);

    // Test with lower threshold to trigger decayed count
    (mockStorage as any)._updates = [];
    const result2 = await engine.applyDecay('gh-1', 90, 0.21, true);
    expect(result2.updated).toBe(2);
    expect(result2.decayed).toBe(1); // sig-1 drops below 0.21
  });
});
