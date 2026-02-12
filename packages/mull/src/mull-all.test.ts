import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mullAll } from './mull-all.js';
import type {
  SessionRef,
  MullAdapter,
  SessionData,
  NuggetSynthesizer,
  TopicStore,
  PreExtract,
  MullConfig,
  SynthesisResult,
  Nugget,
  TopicMergeResult,
} from './domain/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAdapter(overrides: Partial<MullAdapter> = {}): MullAdapter {
  return {
    name: 'test-adapter',
    supports: () => true,
    listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
      { type: 'channel', id: 'ch-1' },
      { type: 'channel', id: 'ch-2' },
    ]),
    loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockImplementation(
      async (ref) => ({
        ref,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: '2026-01-01T00:01:00Z' },
        ],
      })
    ),
    getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    setCursor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSynthesizer(overrides: Partial<NuggetSynthesizer> = {}): NuggetSynthesizer {
  return {
    synthesize: vi.fn<(pre: PreExtract, cfg: MullConfig) => Promise<SynthesisResult>>().mockImplementation(
      async (preExtract) => ({
        nuggets: preExtract.messages
          .filter(m => m.role !== 'system')
          .map((m, i) => ({
            id: `nugget-${i}`,
            content: m.content,
            topic: 'general',
            confidence: 0.8,
            source: { sessionRef: preExtract.sessionRef, messageIds: [m.id] },
          })),
        errors: [],
      })
    ),
    ...overrides,
  };
}

function makeTopicStore(overrides: Partial<TopicStore> = {}): TopicStore {
  return {
    listTopics: vi.fn<() => Promise<string[]>>().mockResolvedValue(['general']),
    merge: vi.fn<(nuggets: Nugget[], dir: string) => Promise<TopicMergeResult>>().mockResolvedValue({
      topicsUpdated: 1,
      topicsCreated: 0,
      nuggetsWritten: 2,
    }),
    rebuildToc: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mullAll()', () => {
  let adapter: MullAdapter;
  let synthesizer: NuggetSynthesizer;
  let topicStore: TopicStore;

  beforeEach(() => {
    adapter = makeAdapter();
    synthesizer = makeSynthesizer();
    topicStore = makeTopicStore();
  });

  // -------------------------------------------------------------------------
  // Batch processing and aggregation
  // -------------------------------------------------------------------------

  it('lists sessions from all adapters and processes each', async () => {
    const result = await mullAll({
      adapters: [adapter],
      synthesizer,
      topicStore,
    });

    expect(adapter.listSessions).toHaveBeenCalledOnce();
    // Two sessions, each producing 2 nuggets
    expect(result.nuggetsWritten).toBe(4);
    expect(result.topicsUpdated).toBe(2);
    expect(result.sessionsProcessed).toBe(2);
    expect(result.sessions).toHaveLength(2);
  });

  it('aggregates MergeResult across all sessions', async () => {
    const result = await mullAll({
      adapters: [adapter],
      synthesizer,
      topicStore,
    });

    expect(result.topicsUpdated).toBe(2);
    expect(result.topicsCreated).toBe(0);
    expect(result.nuggetsWritten).toBe(4);
    expect(result.errors).toHaveLength(0);
  });

  it('tracks per-session success/failure', async () => {
    const result = await mullAll({
      adapters: [adapter],
      synthesizer,
      topicStore,
    });

    expect(result.sessions).toHaveLength(2);
    for (const session of result.sessions) {
      expect(session.success).toBe(true);
      expect(session.result.nuggetsWritten).toBe(2);
    }
  });

  it('returns correct MullAllResult shape', async () => {
    const result = await mullAll({
      adapters: [adapter],
      synthesizer,
      topicStore,
    });

    expect(result).toHaveProperty('topicsUpdated');
    expect(result).toHaveProperty('topicsCreated');
    expect(result).toHaveProperty('nuggetsWritten');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('sessions');
    expect(result).toHaveProperty('sessionsProcessed');
    expect(result).toHaveProperty('sessionsSkipped');
    expect(result).toHaveProperty('sessionsFailed');
    expect(typeof result.sessionsProcessed).toBe('number');
    expect(typeof result.sessionsSkipped).toBe('number');
    expect(typeof result.sessionsFailed).toBe('number');
    expect(Array.isArray(result.sessions)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Per-session failure handling
  // -------------------------------------------------------------------------

  it('continues processing remaining sessions if one fails', async () => {
    let callCount = 0;
    const failingOnFirstAdapter = makeAdapter({
      loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockImplementation(
        async (ref) => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Session load failed');
          }
          return {
            ref,
            messages: [
              { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
            ],
          };
        }
      ),
    });

    const result = await mullAll({
      adapters: [failingOnFirstAdapter],
      synthesizer,
      topicStore,
    });

    // First session failed, second succeeded
    expect(result.sessionsFailed).toBe(1);
    expect(result.sessionsProcessed).toBe(1);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]!.success).toBe(false);
    expect(result.sessions[1]!.success).toBe(true);
  });

  it('aggregates errors from all sessions including failed ones', async () => {
    // Make TOC rebuild fail for each session
    const failingTocStore = makeTopicStore({
      rebuildToc: vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Permission denied')),
    });

    const result = await mullAll({
      adapters: [adapter],
      synthesizer,
      topicStore: failingTocStore,
    });

    // Each session produces a TOC error (recoverable)
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.filter(e => e.stage === 'toc')).toHaveLength(2);
    // Sessions still succeed since TOC failure is non-fatal
    expect(result.sessionsProcessed).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Session skipping
  // -------------------------------------------------------------------------

  it('skips sessions that are already up-to-date (no new messages)', async () => {
    const upToDateAdapter = makeAdapter({
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' },
        { type: 'channel', id: 'ch-2' },
      ]),
      loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockImplementation(
        async (ref) => {
          if (ref.id === 'ch-1') {
            return { ref, messages: [] };
          }
          return {
            ref,
            messages: [
              { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
            ],
          };
        }
      ),
    });

    const result = await mullAll({
      adapters: [upToDateAdapter],
      synthesizer,
      topicStore,
    });

    expect(result.sessionsSkipped).toBe(1);
    expect(result.sessionsProcessed).toBe(1);
    expect(result.nuggetsWritten).toBe(2);
  });

  it('returns empty result when no sessions exist', async () => {
    const emptyAdapter = makeAdapter({
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([]),
    });

    const result = await mullAll({
      adapters: [emptyAdapter],
      synthesizer,
      topicStore,
    });

    expect(result.sessions).toHaveLength(0);
    expect(result.sessionsProcessed).toBe(0);
    expect(result.sessionsSkipped).toBe(0);
    expect(result.sessionsFailed).toBe(0);
    expect(result.nuggetsWritten).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Multi-adapter handling
  // -------------------------------------------------------------------------

  it('collects sessions from multiple adapters', async () => {
    const adapter1 = makeAdapter({
      name: 'adapter-1',
      supports: (ref) => ref.type === 'channel',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' },
      ]),
    });
    const adapter2 = makeAdapter({
      name: 'adapter-2',
      supports: (ref) => ref.type === 'plan_id',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'plan_id', id: 'plan-1' },
      ]),
    });

    const result = await mullAll({
      adapters: [adapter1, adapter2],
      synthesizer,
      topicStore,
    });

    expect(adapter1.listSessions).toHaveBeenCalledOnce();
    expect(adapter2.listSessions).toHaveBeenCalledOnce();
    expect(result.sessions).toHaveLength(2);
  });

  it('deduplicates sessions across adapters', async () => {
    const adapter1 = makeAdapter({
      name: 'adapter-1',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' },
      ]),
    });
    const adapter2 = makeAdapter({
      name: 'adapter-2',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' }, // same session
      ]),
    });

    const result = await mullAll({
      adapters: [adapter1, adapter2],
      synthesizer,
      topicStore,
    });

    // Only processed once despite appearing in two adapters
    expect(result.sessions).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Options passthrough
  // -------------------------------------------------------------------------

  it('passes dryRun option through to mull() for each session', async () => {
    const singleSessionAdapter = makeAdapter({
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' },
      ]),
    });

    const result = await mullAll({
      adapters: [singleSessionAdapter],
      synthesizer,
      topicStore,
      dryRun: true,
    });

    // In dryRun mode, merge and TOC are skipped
    expect(topicStore.merge).not.toHaveBeenCalled();
    expect(topicStore.rebuildToc).not.toHaveBeenCalled();
    expect(result.nuggetsWritten).toBe(2);
  });

  it('passes force option through to mull() for each session', async () => {
    const singleSessionAdapter = makeAdapter({
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' },
      ]),
      getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue('msg-old'),
    });

    await mullAll({
      adapters: [singleSessionAdapter],
      synthesizer,
      topicStore,
      force: true,
    });

    // In force mode, getCursor is NOT called
    expect(singleSessionAdapter.getCursor).not.toHaveBeenCalled();
    // loadSession is called without after filter
    expect(singleSessionAdapter.loadSession).toHaveBeenCalledWith(
      { type: 'channel', id: 'ch-1' },
      undefined,
    );
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  it('throws when no adapters are provided', async () => {
    await expect(
      mullAll({ synthesizer, topicStore })
    ).rejects.toThrow(/No adapters provided/);
  });

  it('throws when adapter.listSessions() fails', async () => {
    const brokenAdapter = makeAdapter({
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockRejectedValue(new Error('Connection refused')),
    });

    await expect(
      mullAll({
        adapters: [brokenAdapter],
        synthesizer,
        topicStore,
      })
    ).rejects.toThrow('Connection refused');
  });

  // -------------------------------------------------------------------------
  // Mixed session type handling across adapters
  // -------------------------------------------------------------------------

  it('handles mixed session types from multiple adapters', async () => {
    const trajectoryAdapter = makeAdapter({
      name: 'trajectory',
      supports: (ref) => ref.type === 'plan_id',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'plan_id', id: 'plan-1' },
      ]),
    });
    const relayAdapter = makeAdapter({
      name: 'relay',
      supports: (ref) => ref.type === 'channel',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'channel', id: 'ch-1' },
      ]),
    });
    const forgeAdapter = makeAdapter({
      name: 'forge',
      supports: (ref) => ref.type === 'run_id',
      listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([
        { type: 'run_id', id: 'run-1' },
      ]),
    });

    const result = await mullAll({
      adapters: [trajectoryAdapter, relayAdapter, forgeAdapter],
      synthesizer,
      topicStore,
    });

    expect(result.sessions).toHaveLength(3);
    expect(result.sessionsProcessed).toBe(3);

    // Verify each ref type was routed to the correct adapter
    expect(trajectoryAdapter.loadSession).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'plan_id', id: 'plan-1' }),
      undefined, // no cursor, so no after filter
    );
    expect(relayAdapter.loadSession).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'channel', id: 'ch-1' }),
      undefined,
    );
    expect(forgeAdapter.loadSession).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run_id', id: 'run-1' }),
      undefined,
    );
  });
});
