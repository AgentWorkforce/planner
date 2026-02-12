import { describe, it, expect, vi } from 'vitest';
import { listAllSessions } from './sessions.js';
import type { SessionAdapter, AdapterSessionInfo, TimeRange } from './core-types.js';

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

function mockListableAdapter(
  type: string,
  sessions: AdapterSessionInfo[] | ((timeRange?: TimeRange) => AdapterSessionInfo[]),
): SessionAdapter {
  return {
    type,
    read: vi.fn(async () => []),
    listSessions: typeof sessions === 'function'
      ? vi.fn(async (timeRange?: TimeRange) => sessions(timeRange))
      : vi.fn(async () => sessions),
  };
}

/** Adapter without listSessions (legacy or unsupported). */
function mockReadOnlyAdapter(type: string): SessionAdapter {
  return {
    type,
    read: vi.fn(async () => []),
    // No listSessions
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listAllSessions', () => {
  // ---- Basic listing ----

  describe('basic listing', () => {
    it('returns sessions from a single adapter', async () => {
      const adapter = mockListableAdapter('relay', [
        { sessionId: 'ses-1', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T01:00:00Z' },
        { sessionId: 'ses-2', startedAt: '2026-01-02T00:00:00Z' },
      ]);

      const result = await listAllSessions([adapter]);

      expect(result).toHaveLength(2);
      expect(result.map(s => s.sessionId)).toContain('ses-1');
      expect(result.map(s => s.sessionId)).toContain('ses-2');
    });

    it('returns sessions from multiple adapters', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-1', startedAt: '2026-01-01T00:00:00Z' },
      ]);
      const trajectory = mockListableAdapter('trajectory', [
        { sessionId: 'ses-2', startedAt: '2026-01-02T00:00:00Z' },
      ]);

      const result = await listAllSessions([relay, trajectory]);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no adapters provided', async () => {
      const result = await listAllSessions([]);
      expect(result).toEqual([]);
    });

    it('returns empty array when all adapters return empty', async () => {
      const relay = mockListableAdapter('relay', []);
      const trajectory = mockListableAdapter('trajectory', []);

      const result = await listAllSessions([relay, trajectory]);

      expect(result).toEqual([]);
    });
  });

  // ---- Deduplication ----

  describe('deduplication by sessionId', () => {
    it('deduplicates sessions with the same sessionId across adapters', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-shared', startedAt: '2026-01-01T00:00:00Z' },
      ]);
      const trajectory = mockListableAdapter('trajectory', [
        { sessionId: 'ses-shared', startedAt: '2026-01-01T00:05:00Z' },
      ]);

      const result = await listAllSessions([relay, trajectory]);

      expect(result).toHaveLength(1);
      expect(result[0]!.sessionId).toBe('ses-shared');
    });

    it('merges adapter sources for deduplicated sessions', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-shared' },
      ]);
      const trajectory = mockListableAdapter('trajectory', [
        { sessionId: 'ses-shared' },
      ]);

      const result = await listAllSessions([relay, trajectory]);

      expect(result).toHaveLength(1);
      expect(result[0]!.adapters).toContain('relay');
      expect(result[0]!.adapters).toContain('trajectory');
      expect(result[0]!.adapters).toHaveLength(2);
    });

    it('does not duplicate adapter type when same adapter reports session', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-1' },
        { sessionId: 'ses-1' }, // duplicate from same adapter
      ]);

      const result = await listAllSessions([relay]);

      expect(result).toHaveLength(1);
      expect(result[0]!.adapters).toEqual(['relay']);
    });

    it('uses earliest startedAt across adapters', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-shared', startedAt: '2026-01-01T10:00:00Z' },
      ]);
      const trajectory = mockListableAdapter('trajectory', [
        { sessionId: 'ses-shared', startedAt: '2026-01-01T05:00:00Z' },
      ]);

      const result = await listAllSessions([relay, trajectory]);

      expect(result[0]!.startedAt).toBe('2026-01-01T05:00:00Z');
    });

    it('uses latest endedAt across adapters', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-shared', endedAt: '2026-01-01T10:00:00Z' },
      ]);
      const trajectory = mockListableAdapter('trajectory', [
        { sessionId: 'ses-shared', endedAt: '2026-01-01T15:00:00Z' },
      ]);

      const result = await listAllSessions([relay, trajectory]);

      expect(result[0]!.endedAt).toBe('2026-01-01T15:00:00Z');
    });

    it('handles one adapter having time range and the other not', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-shared', startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T12:00:00Z' },
      ]);
      const trajectory = mockListableAdapter('trajectory', [
        { sessionId: 'ses-shared' }, // no time info
      ]);

      const result = await listAllSessions([relay, trajectory]);

      expect(result[0]!.startedAt).toBe('2026-01-01T10:00:00Z');
      expect(result[0]!.endedAt).toBe('2026-01-01T12:00:00Z');
    });
  });

  // ---- Adapter filtering ----

  describe('adapter filtering', () => {
    it('skips adapters without listSessions', async () => {
      const withList = mockListableAdapter('relay', [
        { sessionId: 'ses-1', startedAt: '2026-01-01T00:00:00Z' },
      ]);
      const withoutList = mockReadOnlyAdapter('legacy');

      const result = await listAllSessions([withList, withoutList]);

      expect(result).toHaveLength(1);
      expect(result[0]!.sessionId).toBe('ses-1');
    });

    it('returns empty when all adapters lack listSessions', async () => {
      const legacy1 = mockReadOnlyAdapter('legacy1');
      const legacy2 = mockReadOnlyAdapter('legacy2');

      const result = await listAllSessions([legacy1, legacy2]);

      expect(result).toEqual([]);
    });
  });

  // ---- Time range filter ----

  describe('time range filter', () => {
    it('passes timeRange to each adapter', async () => {
      const relay = mockListableAdapter('relay', []);
      const trajectory = mockListableAdapter('trajectory', []);
      const timeRange: TimeRange = {
        after: '2026-01-01T00:00:00Z',
        before: '2026-02-01T00:00:00Z',
      };

      await listAllSessions([relay, trajectory], timeRange);

      expect(relay.listSessions).toHaveBeenCalledWith(timeRange);
      expect(trajectory.listSessions).toHaveBeenCalledWith(timeRange);
    });

    it('passes undefined timeRange when not provided', async () => {
      const relay = mockListableAdapter('relay', []);

      await listAllSessions([relay]);

      expect(relay.listSessions).toHaveBeenCalledWith(undefined);
    });

    it('adapter can filter by timeRange', async () => {
      const adapter = mockListableAdapter('relay', (timeRange?: TimeRange) => {
        const all = [
          { sessionId: 'old', startedAt: '2025-01-01T00:00:00Z' },
          { sessionId: 'new', startedAt: '2026-01-01T00:00:00Z' },
        ];
        if (timeRange?.after) {
          return all.filter(s => s.startedAt! >= timeRange.after!);
        }
        return all;
      });

      const result = await listAllSessions([adapter], { after: '2025-06-01T00:00:00Z' });

      expect(result).toHaveLength(1);
      expect(result[0]!.sessionId).toBe('new');
    });
  });

  // ---- Sorting ----

  describe('sorting', () => {
    it('sorts sessions by startedAt descending (most recent first)', async () => {
      const adapter = mockListableAdapter('relay', [
        { sessionId: 'old', startedAt: '2026-01-01T00:00:00Z' },
        { sessionId: 'new', startedAt: '2026-02-01T00:00:00Z' },
        { sessionId: 'mid', startedAt: '2026-01-15T00:00:00Z' },
      ]);

      const result = await listAllSessions([adapter]);

      expect(result.map(s => s.sessionId)).toEqual(['new', 'mid', 'old']);
    });

    it('sessions without startedAt sort last', async () => {
      const adapter = mockListableAdapter('relay', [
        { sessionId: 'no-time' },
        { sessionId: 'with-time', startedAt: '2026-01-01T00:00:00Z' },
      ]);

      const result = await listAllSessions([adapter]);

      expect(result[0]!.sessionId).toBe('with-time');
      expect(result[1]!.sessionId).toBe('no-time');
    });
  });

  // ---- Adapter sources tracking ----

  describe('adapter source tracking', () => {
    it('single adapter session has one adapter in list', async () => {
      const relay = mockListableAdapter('relay', [
        { sessionId: 'ses-1' },
      ]);

      const result = await listAllSessions([relay]);

      expect(result[0]!.adapters).toEqual(['relay']);
    });

    it('session from three adapters lists all three', async () => {
      const relay = mockListableAdapter('relay', [{ sessionId: 'ses-shared' }]);
      const trajectory = mockListableAdapter('trajectory', [{ sessionId: 'ses-shared' }]);
      const transcript = mockListableAdapter('transcript', [{ sessionId: 'ses-shared' }]);

      const result = await listAllSessions([relay, trajectory, transcript]);

      expect(result).toHaveLength(1);
      expect(result[0]!.adapters).toHaveLength(3);
      expect(result[0]!.adapters).toContain('relay');
      expect(result[0]!.adapters).toContain('trajectory');
      expect(result[0]!.adapters).toContain('transcript');
    });
  });

  // ---- Error handling ----

  describe('error handling', () => {
    it('propagates adapter errors', async () => {
      const failingAdapter: SessionAdapter = {
        type: 'failing',
        read: vi.fn(async () => []),
        listSessions: vi.fn(async () => { throw new Error('DB connection failed'); }),
      };

      await expect(listAllSessions([failingAdapter])).rejects.toThrow('DB connection failed');
    });
  });
});
