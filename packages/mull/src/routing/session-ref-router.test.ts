import { describe, it, expect, vi } from 'vitest';
import { normalizeSessionRef, routeSessionRef } from './session-ref-router.js';
import type { SessionRef, MullAdapter, SessionData } from '../domain/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAdapter(name: string, supportedTypes: SessionRef['type'][]): MullAdapter {
  return {
    name,
    supports: (ref: SessionRef) => supportedTypes.includes(ref.type),
    listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([]),
    loadSession: vi.fn<(ref: SessionRef) => Promise<SessionData>>().mockResolvedValue({
      ref: { type: 'plan_id', id: 'stub' },
      messages: [],
    }),
    getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    setCursor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// normalizeSessionRef
// ---------------------------------------------------------------------------

describe('normalizeSessionRef()', () => {
  it('converts a plain string to plan_id SessionRef', () => {
    const result = normalizeSessionRef('my-plan-123');
    expect(result).toEqual({ type: 'plan_id', id: 'my-plan-123' });
  });

  it('returns plan_id SessionRef unchanged', () => {
    const ref: SessionRef = { type: 'plan_id', id: 'plan-abc' };
    expect(normalizeSessionRef(ref)).toEqual(ref);
  });

  it('returns run_id SessionRef unchanged', () => {
    const ref: SessionRef = { type: 'run_id', id: 'run-456' };
    expect(normalizeSessionRef(ref)).toEqual(ref);
  });

  it('returns channel SessionRef unchanged', () => {
    const ref: SessionRef = { type: 'channel', id: '#general' };
    expect(normalizeSessionRef(ref)).toEqual(ref);
  });

  it('handles empty string as plan_id', () => {
    const result = normalizeSessionRef('');
    expect(result).toEqual({ type: 'plan_id', id: '' });
  });

  it('handles UUID-like strings as plan_id', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const result = normalizeSessionRef(uuid);
    expect(result).toEqual({ type: 'plan_id', id: uuid });
  });
});

// ---------------------------------------------------------------------------
// routeSessionRef
// ---------------------------------------------------------------------------

describe('routeSessionRef()', () => {
  describe('plan_id routing', () => {
    it('routes plan_id to trajectory adapter', () => {
      const trajectoryAdapter = makeAdapter('trail', ['plan_id']);
      const relayAdapter = makeAdapter('relay', ['channel', 'run_id']);

      const result = routeSessionRef(
        { type: 'plan_id', id: 'plan-123' },
        [trajectoryAdapter, relayAdapter],
      );

      expect(result.name).toBe('trail');
    });
  });

  describe('run_id routing', () => {
    it('routes run_id to forge/relay adapter', () => {
      const trajectoryAdapter = makeAdapter('trail', ['plan_id']);
      const forgeAdapter = makeAdapter('forge', ['run_id']);

      const result = routeSessionRef(
        { type: 'run_id', id: 'run-456' },
        [trajectoryAdapter, forgeAdapter],
      );

      expect(result.name).toBe('forge');
    });
  });

  describe('channel routing', () => {
    it('routes channel to relay adapter', () => {
      const trajectoryAdapter = makeAdapter('trail', ['plan_id']);
      const relayAdapter = makeAdapter('relay', ['channel']);

      const result = routeSessionRef(
        { type: 'channel', id: '#planner' },
        [trajectoryAdapter, relayAdapter],
      );

      expect(result.name).toBe('relay');
    });
  });

  describe('error handling', () => {
    it('throws descriptive error when no adapter matches plan_id', () => {
      const relayAdapter = makeAdapter('relay', ['channel']);

      expect(() =>
        routeSessionRef({ type: 'plan_id', id: 'plan-123' }, [relayAdapter])
      ).toThrow(/No adapter found for SessionRef.*plan_id/);

      expect(() =>
        routeSessionRef({ type: 'plan_id', id: 'plan-123' }, [relayAdapter])
      ).toThrow(/Expected a 'trail' adapter/);
    });

    it('throws descriptive error when no adapter matches run_id', () => {
      const trajectoryAdapter = makeAdapter('trail', ['plan_id']);

      expect(() =>
        routeSessionRef({ type: 'run_id', id: 'run-456' }, [trajectoryAdapter])
      ).toThrow(/No adapter found for SessionRef.*run_id/);

      expect(() =>
        routeSessionRef({ type: 'run_id', id: 'run-456' }, [trajectoryAdapter])
      ).toThrow(/Expected a 'forge\/relay' adapter/);
    });

    it('throws descriptive error when no adapter matches channel', () => {
      const trajectoryAdapter = makeAdapter('trail', ['plan_id']);

      expect(() =>
        routeSessionRef({ type: 'channel', id: '#general' }, [trajectoryAdapter])
      ).toThrow(/No adapter found for SessionRef.*channel/);

      expect(() =>
        routeSessionRef({ type: 'channel', id: '#general' }, [trajectoryAdapter])
      ).toThrow(/Expected a 'relay' adapter/);
    });

    it('lists configured adapters in error message', () => {
      const adapter1 = makeAdapter('trail', ['plan_id']);
      const adapter2 = makeAdapter('forge', ['run_id']);

      expect(() =>
        routeSessionRef({ type: 'channel', id: '#ch' }, [adapter1, adapter2])
      ).toThrow(/Configured adapters: \[trail, forge\]/);
    });

    it('throws when adapters array is empty', () => {
      expect(() =>
        routeSessionRef({ type: 'plan_id', id: 'plan-123' }, [])
      ).toThrow(/No adapters configured/);
    });
  });

  describe('adapter selection', () => {
    it('returns the first matching adapter when multiple match', () => {
      const adapter1 = makeAdapter('first-relay', ['channel']);
      const adapter2 = makeAdapter('second-relay', ['channel']);

      const result = routeSessionRef(
        { type: 'channel', id: '#ch' },
        [adapter1, adapter2],
      );

      expect(result.name).toBe('first-relay');
    });

    it('works with an adapter supporting multiple ref types', () => {
      const multiAdapter = makeAdapter('multi', ['plan_id', 'run_id', 'channel']);

      const result1 = routeSessionRef({ type: 'plan_id', id: 'p1' }, [multiAdapter]);
      const result2 = routeSessionRef({ type: 'run_id', id: 'r1' }, [multiAdapter]);
      const result3 = routeSessionRef({ type: 'channel', id: '#ch' }, [multiAdapter]);

      expect(result1.name).toBe('multi');
      expect(result2.name).toBe('multi');
      expect(result3.name).toBe('multi');
    });
  });
});
