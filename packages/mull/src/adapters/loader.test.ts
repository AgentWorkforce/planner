import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadSessionFromAdapters,
  entriesToSessionData,
  sessionIdFromRef,
  type SessionRef,
  type LoadSessionOptions,
} from './loader.js';
import { setCursor } from './cursor.js';
import type { SessionAdapter, SessionEntry, Cursor } from './core-types.js';

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

function mockAdapter(
  type: string,
  entries: SessionEntry[] | ((sessionId: string, since?: Cursor) => SessionEntry[]),
): SessionAdapter {
  return {
    type,
    read: typeof entries === 'function'
      ? vi.fn(async (sessionId: string, since?: Cursor) => entries(sessionId, since))
      : vi.fn(async () => entries),
  };
}

// ---------------------------------------------------------------------------
// sessionIdFromRef
// ---------------------------------------------------------------------------

describe('sessionIdFromRef', () => {
  it('returns plan_id for plan ref', () => {
    expect(sessionIdFromRef({ type: 'plan', plan_id: 'plan-abc-123' })).toBe('plan-abc-123');
  });

  it('returns run_id for run ref', () => {
    expect(sessionIdFromRef({ type: 'run', run_id: 'run-xyz-789' })).toBe('run-xyz-789');
  });

  it('strips # prefix from channel ref', () => {
    expect(sessionIdFromRef({ type: 'channel', channel: '#plan-abc' })).toBe('plan-abc');
  });

  it('sanitizes non-safe characters in channel ref', () => {
    expect(sessionIdFromRef({ type: 'channel', channel: '#plan.abc/def' })).toBe('plan_abc_def');
  });

  it('handles channel without # prefix', () => {
    expect(sessionIdFromRef({ type: 'channel', channel: 'general' })).toBe('general');
  });
});

// ---------------------------------------------------------------------------
// entriesToSessionData
// ---------------------------------------------------------------------------

describe('entriesToSessionData', () => {
  it('classifies message entries', () => {
    const entries: SessionEntry[] = [
      {
        timestamp: '2026-01-01T00:00:00Z',
        source: 'relay',
        type: 'message',
        content: { role: 'user', content: 'hello' },
      },
    ];

    const result = entriesToSessionData(entries, 'ses-1');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      timestamp: '2026-01-01T00:00:00Z',
      source: 'relay',
      role: 'user',
      content: 'hello',
    });
  });

  it('classifies decision entries', () => {
    const entries: SessionEntry[] = [
      {
        timestamp: '2026-01-01T00:01:00Z',
        source: 'trail',
        type: 'decision',
        content: { id: 'd1', description: 'Use SQLite', rationale: 'Simple' },
      },
    ];

    const result = entriesToSessionData(entries, 'ses-1');
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]).toEqual({
      id: 'd1',
      timestamp: '2026-01-01T00:01:00Z',
      source: 'trail',
      description: 'Use SQLite',
      rationale: 'Simple',
    });
  });

  it('generates decision id when missing', () => {
    const entries: SessionEntry[] = [
      {
        timestamp: '2026-01-01T00:01:00Z',
        source: 'trail',
        type: 'decision',
        content: { description: 'Use SQLite' },
      },
    ];

    const result = entriesToSessionData(entries, 'ses-1');
    expect(result.decisions[0]!.id).toBe('trail-2026-01-01T00:01:00Z');
  });

  it('classifies retrospective entries (first wins)', () => {
    const entries: SessionEntry[] = [
      { timestamp: '2026-01-01T00:02:00Z', source: 'trail', type: 'retrospective', content: 'First retro' },
      { timestamp: '2026-01-01T00:03:00Z', source: 'trail', type: 'retrospective', content: 'Second retro' },
    ];

    const result = entriesToSessionData(entries, 'ses-1');
    expect(result.retrospective).toBe('First retro');
  });

  it('classifies artifact entries', () => {
    const entries: SessionEntry[] = [
      {
        timestamp: '2026-01-01T00:04:00Z',
        source: 'relay',
        type: 'artifact',
        content: { id: 'art-1', type: 'file', path: '/src/main.ts' },
      },
    ];

    const result = entriesToSessionData(entries, 'ses-1');
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toEqual({
      id: 'art-1',
      source: 'relay',
      type: 'file',
      path: '/src/main.ts',
      content: undefined,
    });
  });

  it('classifies unknown entry types as events', () => {
    const entries: SessionEntry[] = [
      {
        timestamp: '2026-01-01T00:05:00Z',
        source: 'relay',
        type: 'channel_join',
        content: { channel: '#plan-1' },
      },
    ];

    const result = entriesToSessionData(entries, 'ses-1');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      timestamp: '2026-01-01T00:05:00Z',
      source: 'relay',
      type: 'channel_join',
      payload: { channel: '#plan-1' },
    });
  });

  it('sets metadata.session_id', () => {
    const result = entriesToSessionData([], 'ses-42');
    expect(result.metadata.session_id).toBe('ses-42');
  });

  it('returns empty arrays for no entries', () => {
    const result = entriesToSessionData([], 'ses-1');
    expect(result.messages).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.artifacts).toEqual([]);
    expect(result.retrospective).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadSessionFromAdapters
// ---------------------------------------------------------------------------

describe('loadSessionFromAdapters', () => {
  let tmpDir: string;
  let mullDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mull-loader-test-'));
    mullDir = path.join(tmpDir, '.mull');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ---- Routing ----

  describe('SessionRef routing', () => {
    it('plan_id routes to trajectory adapter only', async () => {
      const trajectory = mockAdapter('trail', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'trail', type: 'decision', content: { id: 'd1', description: 'test' } },
      ]);
      const relay = mockAdapter('relay', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'relay', type: 'message', content: { role: 'user', content: 'hi' } },
      ]);

      const ref: SessionRef = { type: 'plan', plan_id: 'plan-1' };
      const result = await loadSessionFromAdapters(ref, [trajectory, relay], { mullDir });

      expect(trajectory.read).toHaveBeenCalledOnce();
      expect(relay.read).not.toHaveBeenCalled();
      expect(result.decisions).toHaveLength(1);
      expect(result.messages).toHaveLength(0);
    });

    it('run_id routes to relay, transcript, and forge adapters', async () => {
      const trajectory = mockAdapter('trail', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'trail', type: 'decision', content: { id: 'd1', description: 'test' } },
      ]);
      const relay = mockAdapter('relay', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'relay', type: 'message', content: { role: 'user', content: 'hi' } },
      ]);
      const transcript = mockAdapter('transcript', [
        { timestamp: '2026-01-01T00:01:00Z', source: 'transcript', type: 'message', content: { role: 'assistant', content: 'hello' } },
      ]);
      const forge = mockAdapter('forge', [
        { timestamp: '2026-01-01T00:02:00Z', source: 'forge', type: 'decision', content: { id: 'd2', description: 'Use Express' } },
      ]);

      const ref: SessionRef = { type: 'run', run_id: 'run-abc' };
      const result = await loadSessionFromAdapters(ref, [trajectory, relay, transcript, forge], { mullDir });

      expect(trajectory.read).not.toHaveBeenCalled();
      expect(relay.read).toHaveBeenCalledOnce();
      expect(transcript.read).toHaveBeenCalledOnce();
      expect(forge.read).toHaveBeenCalledOnce();
      expect(result.messages).toHaveLength(2);
      expect(result.decisions).toHaveLength(1);
    });

    it('channel routes to relay adapter only', async () => {
      const trajectory = mockAdapter('trail', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'trail', type: 'decision', content: { id: 'd1', description: 'test' } },
      ]);
      const relay = mockAdapter('relay', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'relay', type: 'message', content: { role: 'agent', content: 'status update' } },
      ]);

      const ref: SessionRef = { type: 'channel', channel: '#plan-abc' };
      const result = await loadSessionFromAdapters(ref, [trajectory, relay], { mullDir });

      expect(trajectory.read).not.toHaveBeenCalled();
      expect(relay.read).toHaveBeenCalledOnce();
      expect(result.messages).toHaveLength(1);
    });

    it('throws when no applicable adapters found', async () => {
      const relay = mockAdapter('relay', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'plan-1' };

      await expect(
        loadSessionFromAdapters(ref, [relay], { mullDir }),
      ).rejects.toThrow('No applicable adapters');
    });

    it('throws with helpful message listing expected vs got adapter types', async () => {
      const relay = mockAdapter('relay', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'plan-1' };

      await expect(
        loadSessionFromAdapters(ref, [relay], { mullDir }),
      ).rejects.toThrow('Expected adapter types: trail; got: relay');
    });
  });

  // ---- Session ID derivation ----

  describe('session ID derivation', () => {
    it('passes plan_id as sessionId to adapter.read()', async () => {
      const trajectory = mockAdapter('trail', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'my-plan-id' };

      await loadSessionFromAdapters(ref, [trajectory], { mullDir });

      expect(trajectory.read).toHaveBeenCalledWith('my-plan-id', undefined);
    });

    it('passes run_id as sessionId to adapter.read()', async () => {
      const relay = mockAdapter('relay', []);
      const ref: SessionRef = { type: 'run', run_id: 'run-42' };

      await loadSessionFromAdapters(ref, [relay], { mullDir });

      expect(relay.read).toHaveBeenCalledWith('run-42', undefined);
    });

    it('passes sanitized channel as sessionId to adapter.read()', async () => {
      const relay = mockAdapter('relay', []);
      const ref: SessionRef = { type: 'channel', channel: '#plan-abc' };

      await loadSessionFromAdapters(ref, [relay], { mullDir });

      expect(relay.read).toHaveBeenCalledWith('plan-abc', undefined);
    });
  });

  // ---- Cursor-based incremental filtering ----

  describe('cursor integration', () => {
    it('passes cursor to adapter.read() when cursor exists', async () => {
      await setCursor('trail', 'plan-1', '2026-01-01T00:00:00Z', mullDir);

      const trajectory = mockAdapter('trail', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'plan-1' };

      await loadSessionFromAdapters(ref, [trajectory], { mullDir });

      // The cursor should be passed as the second argument
      expect(trajectory.read).toHaveBeenCalledWith('plan-1', {
        last_mulled_at: '2026-01-01T00:00:00Z',
        adapter_type: 'trail',
        session_id: 'plan-1',
      });
    });

    it('passes undefined cursor when no cursor exists', async () => {
      const trajectory = mockAdapter('trail', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'plan-no-cursor' };

      await loadSessionFromAdapters(ref, [trajectory], { mullDir });

      expect(trajectory.read).toHaveBeenCalledWith('plan-no-cursor', undefined);
    });

    it('ignores cursors when force=true', async () => {
      await setCursor('trail', 'plan-1', '2026-01-01T00:00:00Z', mullDir);

      const trajectory = mockAdapter('trail', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'plan-1' };

      await loadSessionFromAdapters(ref, [trajectory], { mullDir, force: true });

      // Cursor should NOT be passed when force=true
      expect(trajectory.read).toHaveBeenCalledWith('plan-1', undefined);
    });
  });

  // ---- Empty filtering ----

  describe('empty result filtering', () => {
    it('filters out adapters that return no entries', async () => {
      const relay = mockAdapter('relay', []); // empty
      const transcript = mockAdapter('transcript', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'transcript', type: 'message', content: { role: 'assistant', content: 'hello' } },
      ]);

      const ref: SessionRef = { type: 'run', run_id: 'run-1' };
      const result = await loadSessionFromAdapters(ref, [relay, transcript], { mullDir });

      // Only transcript data should be in the result
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.source).toBe('transcript');
    });

    it('returns empty SessionData when all adapters return empty', async () => {
      const trajectory = mockAdapter('trail', []);
      const ref: SessionRef = { type: 'plan', plan_id: 'plan-empty' };

      const result = await loadSessionFromAdapters(ref, [trajectory], { mullDir });

      expect(result.messages).toEqual([]);
      expect(result.events).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.retrospective).toBeNull();
      expect(result.artifacts).toEqual([]);
      expect(result.metadata.session_id).toBe('plan-empty');
    });
  });

  // ---- Merge integration ----

  describe('merge integration', () => {
    it('merges data from multiple adapters', async () => {
      const relay = mockAdapter('relay', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'relay', type: 'message', content: { role: 'user', content: 'start task' } },
        { timestamp: '2026-01-01T00:02:00Z', source: 'relay', type: 'message', content: { role: 'agent', content: 'on it' } },
      ]);
      const transcript = mockAdapter('transcript', [
        { timestamp: '2026-01-01T00:01:00Z', source: 'transcript', type: 'message', content: { role: 'assistant', content: 'analyzing' } },
        { timestamp: '2026-01-01T00:03:00Z', source: 'transcript', type: 'decision', content: { id: 'd1', description: 'Use Express' } },
      ]);

      const ref: SessionRef = { type: 'run', run_id: 'run-merge' };
      const result = await loadSessionFromAdapters(ref, [relay, transcript], { mullDir });

      // Messages interleaved by timestamp
      expect(result.messages).toHaveLength(3);
      expect(result.messages.map(m => m.content)).toEqual(['start task', 'analyzing', 'on it']);

      // Decisions from transcript
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0]!.description).toBe('Use Express');
    });

    it('preserves retrospective from adapter that provides it', async () => {
      const relay = mockAdapter('relay', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'relay', type: 'retrospective', content: 'Session went well.' },
      ]);
      const transcript = mockAdapter('transcript', [
        { timestamp: '2026-01-01T00:01:00Z', source: 'transcript', type: 'message', content: { role: 'assistant', content: 'done' } },
      ]);

      const ref: SessionRef = { type: 'run', run_id: 'run-retro' };
      const result = await loadSessionFromAdapters(ref, [relay, transcript], { mullDir });

      expect(result.retrospective).toBe('Session went well.');
    });

    it('sets correct session_id in merged metadata', async () => {
      const trajectory = mockAdapter('trail', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'trail', type: 'decision', content: { id: 'd1', description: 'test' } },
      ]);

      const ref: SessionRef = { type: 'plan', plan_id: 'plan-meta-test' };
      const result = await loadSessionFromAdapters(ref, [trajectory], { mullDir });

      expect(result.metadata.session_id).toBe('plan-meta-test');
    });
  });

  // ---- Default options ----

  describe('default options', () => {
    it('works with no options argument', async () => {
      const trajectory = mockAdapter('trail', [
        { timestamp: '2026-01-01T00:00:00Z', source: 'trail', type: 'decision', content: { id: 'd1', description: 'test' } },
      ]);

      const ref: SessionRef = { type: 'plan', plan_id: 'plan-defaults' };
      // Should not throw - options are optional
      const result = await loadSessionFromAdapters(ref, [trajectory]);

      expect(result.decisions).toHaveLength(1);
    });
  });
});
