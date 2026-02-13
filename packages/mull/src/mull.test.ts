import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mull } from './mull.js';
import { FileTopicStore } from './defaults/topic-store.js';
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
      { type: 'channel', id: 'test-ch' },
    ]),
    loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockResolvedValue({
      ref: { type: 'channel', id: 'test-ch' },
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: '2026-01-01T00:01:00Z' },
      ],
    }),
    getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    setCursor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Synthesizer that produces deterministic nuggets with stable IDs (for idempotency tests). */
function makeDeterministicSynthesizer(): NuggetSynthesizer {
  return {
    synthesize: vi.fn<(pre: PreExtract, cfg: MullConfig) => Promise<SynthesisResult>>().mockImplementation(
      async (preExtract) => ({
        nuggets: preExtract.messages
          .filter(m => m.role !== 'system')
          .map((m, i) => ({
            id: `nugget-${m.id}`,
            content: m.content,
            topic: 'general',
            confidence: 0.8,
            source: { sessionRef: preExtract.sessionRef, messageIds: [m.id] },
          })),
        errors: [],
      })
    ),
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
    merge: vi.fn<(nuggets: Nugget[], dir: string, sessionId: string) => Promise<TopicMergeResult>>().mockResolvedValue({
      topicsUpdated: 1,
      topicsCreated: 0,
      nuggetsWritten: 2,
    }),
    rebuildToc: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

const REF: SessionRef = { type: 'channel', id: 'test-ch' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mull()', () => {
  let adapter: MullAdapter;
  let synthesizer: NuggetSynthesizer;
  let topicStore: TopicStore;

  beforeEach(() => {
    adapter = makeAdapter();
    synthesizer = makeSynthesizer();
    topicStore = makeTopicStore();
  });

  // -------------------------------------------------------------------------
  // End-to-end pipeline
  // -------------------------------------------------------------------------

  it('executes full pipeline: load → extract → synthesize → merge → TOC → cursor', async () => {
    const result = await mull(REF, {
      adapters: [adapter],
      synthesizer,
      topicStore,
    });

    expect(result.nuggetsWritten).toBe(2);
    expect(result.topicsUpdated).toBe(1);
    expect(result.topicsCreated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.llmFailed).toBe(false);

    // Verify all pipeline stages were called in order
    expect(adapter.getCursor).toHaveBeenCalledOnce();
    expect(adapter.loadSession).toHaveBeenCalledOnce();
    expect(synthesizer.synthesize).toHaveBeenCalledOnce();
    expect(topicStore.merge).toHaveBeenCalledOnce();
    expect(topicStore.rebuildToc).toHaveBeenCalledOnce();
    expect(adapter.setCursor).toHaveBeenCalledOnce();
  });

  it('returns MullResult with correct shape including llmFailed', async () => {
    const result = await mull(REF, {
      adapters: [adapter],
      synthesizer,
      topicStore,
    });

    expect(result).toHaveProperty('topicsUpdated');
    expect(result).toHaveProperty('topicsCreated');
    expect(result).toHaveProperty('nuggetsWritten');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('llmFailed');
    expect(typeof result.topicsUpdated).toBe('number');
    expect(typeof result.topicsCreated).toBe('number');
    expect(typeof result.nuggetsWritten).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.llmFailed).toBe('boolean');
    expect(result.llmFailed).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Dry-run mode
  // -------------------------------------------------------------------------

  describe('dryRun mode', () => {
    it('runs extraction + synthesis but skips merge, TOC, and cursor', async () => {
      const result = await mull(REF, {
        adapters: [adapter],
        synthesizer,
        topicStore,
        dryRun: true,
      });

      // Synthesis ran
      expect(synthesizer.synthesize).toHaveBeenCalledOnce();
      expect(result.nuggetsWritten).toBe(2);

      // No files written
      expect(topicStore.merge).not.toHaveBeenCalled();
      expect(topicStore.rebuildToc).not.toHaveBeenCalled();
      expect(adapter.setCursor).not.toHaveBeenCalled();
    });

    it('still returns MullResult with estimated counts', async () => {
      const result = await mull(REF, {
        adapters: [adapter],
        synthesizer,
        topicStore,
        dryRun: true,
      });

      // topicsUpdated is the count of unique topics in the synthesized nuggets
      expect(result.topicsUpdated).toBe(1); // all nuggets map to 'general'
      expect(result.nuggetsWritten).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.llmFailed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Force mode
  // -------------------------------------------------------------------------

  describe('force mode', () => {
    it('ignores cursor and re-processes entire session', async () => {
      const cursorAdapter = makeAdapter({
        getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue('msg-5'),
      });

      await mull(REF, {
        adapters: [cursorAdapter],
        synthesizer,
        topicStore,
        force: true,
      });

      // getCursor should NOT be called in force mode
      expect(cursorAdapter.getCursor).not.toHaveBeenCalled();

      // loadSession should be called without after filter
      expect(cursorAdapter.loadSession).toHaveBeenCalledWith(
        REF,
        undefined,
      );
    });

    it('still produces a full MullResult', async () => {
      const cursorAdapter = makeAdapter({
        getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue('msg-5'),
      });

      const result = await mull(REF, {
        adapters: [cursorAdapter],
        synthesizer,
        topicStore,
        force: true,
      });

      expect(result.nuggetsWritten).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // SessionRef routing
  // -------------------------------------------------------------------------

  describe('SessionRef routing', () => {
    it('routes plan_id ref to the plan adapter', async () => {
      const planAdapter = makeAdapter({
        name: 'trajectory',
        supports: (ref) => ref.type === 'plan_id',
      });
      const channelAdapter = makeAdapter({
        name: 'relay',
        supports: (ref) => ref.type === 'channel',
      });
      const runAdapter = makeAdapter({
        name: 'forge',
        supports: (ref) => ref.type === 'run_id',
      });

      await mull({ type: 'plan_id', id: 'plan-abc' }, {
        adapters: [planAdapter, channelAdapter, runAdapter],
        synthesizer,
        topicStore,
      });

      expect(planAdapter.loadSession).toHaveBeenCalledOnce();
      expect(channelAdapter.loadSession).not.toHaveBeenCalled();
      expect(runAdapter.loadSession).not.toHaveBeenCalled();
    });

    it('routes run_id ref to the run adapter', async () => {
      const planAdapter = makeAdapter({
        name: 'trajectory',
        supports: (ref) => ref.type === 'plan_id',
      });
      const channelAdapter = makeAdapter({
        name: 'relay',
        supports: (ref) => ref.type === 'channel',
      });
      const runAdapter = makeAdapter({
        name: 'forge',
        supports: (ref) => ref.type === 'run_id',
      });

      await mull({ type: 'run_id', id: 'run-def' }, {
        adapters: [planAdapter, channelAdapter, runAdapter],
        synthesizer,
        topicStore,
      });

      expect(runAdapter.loadSession).toHaveBeenCalledOnce();
      expect(planAdapter.loadSession).not.toHaveBeenCalled();
      expect(channelAdapter.loadSession).not.toHaveBeenCalled();
    });

    it('routes channel ref to the channel adapter', async () => {
      const planAdapter = makeAdapter({
        name: 'trajectory',
        supports: (ref) => ref.type === 'plan_id',
      });
      const channelAdapter = makeAdapter({
        name: 'relay',
        supports: (ref) => ref.type === 'channel',
      });
      const runAdapter = makeAdapter({
        name: 'forge',
        supports: (ref) => ref.type === 'run_id',
      });

      await mull({ type: 'channel', id: 'ch-ghi' }, {
        adapters: [planAdapter, channelAdapter, runAdapter],
        synthesizer,
        topicStore,
      });

      expect(channelAdapter.loadSession).toHaveBeenCalledOnce();
      expect(planAdapter.loadSession).not.toHaveBeenCalled();
      expect(runAdapter.loadSession).not.toHaveBeenCalled();
    });

    it('throws when no adapter supports the SessionRef', async () => {
      const planOnlyAdapter = makeAdapter({
        name: 'plan-only',
        supports: (ref) => ref.type === 'plan_id',
      });

      await expect(
        mull({ type: 'channel', id: 'ch-1' }, {
          adapters: [planOnlyAdapter],
          synthesizer,
          topicStore,
        })
      ).rejects.toThrow(/No adapter found for SessionRef.*'channel'/);
    });
  });

  // -------------------------------------------------------------------------
  // Cursor management
  // -------------------------------------------------------------------------

  describe('cursor management', () => {
    it('passes cursor to loadSession as after filter', async () => {
      const cursorAdapter = makeAdapter({
        getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue('msg-5'),
      });

      await mull(REF, {
        adapters: [cursorAdapter],
        synthesizer,
        topicStore,
      });

      expect(cursorAdapter.loadSession).toHaveBeenCalledWith(
        REF,
        { after: 'msg-5' },
      );
    });

    it('updates cursor to last message ID after successful processing', async () => {
      await mull(REF, {
        adapters: [adapter],
        synthesizer,
        topicStore,
      });

      expect(adapter.setCursor).toHaveBeenCalledWith(REF, 'msg-2');
    });

    it('loads session without cursor filter when getCursor returns null', async () => {
      await mull(REF, {
        adapters: [adapter],
        synthesizer,
        topicStore,
      });

      expect(adapter.getCursor).toHaveBeenCalledOnce();
      expect(adapter.loadSession).toHaveBeenCalledWith(REF, undefined);
    });
  });

  // -------------------------------------------------------------------------
  // Partial failure: LLM fails but trail decision nuggets written
  // -------------------------------------------------------------------------

  describe('partial failure handling', () => {
    // Adapter with structured decisions — trail decision shortcut extracts these
    function makeDecisionAdapter(): MullAdapter {
      return makeAdapter({
        loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockResolvedValue({
          ref: REF,
          messages: [
            { id: 'msg-1', role: 'user', content: 'Should we use OAuth?', timestamp: '2026-01-01T00:00:00Z' },
            { id: 'msg-2', role: 'assistant', content: 'Yes, OAuth 2.0 with PKCE', timestamp: '2026-01-01T00:01:00Z' },
          ],
          decisions: [
            { id: 'dec-1', description: 'Use OAuth 2.0 with PKCE for auth', rationale: 'Need third-party provider support', timestamp: '2026-01-01T00:01:00Z' },
            { id: 'dec-2', description: 'Use SQLite for local storage', rationale: 'Simpler than PostgreSQL for MVP', timestamp: '2026-01-01T00:02:00Z' },
          ],
        }),
      });
    }

    it('falls back to trail decision nuggets when LLM synthesis throws', async () => {
      const failingSynthesizer = makeSynthesizer({
        synthesize: vi.fn<() => Promise<SynthesisResult>>().mockRejectedValue(new Error('LLM timeout')),
      });
      const decisionAdapter = makeDecisionAdapter();

      const result = await mull(REF, {
        adapters: [decisionAdapter],
        synthesizer: failingSynthesizer,
        topicStore,
      });

      // Trail decision nuggets were written (2 structured decisions)
      expect(result.nuggetsWritten).toBe(2);
      expect(result.llmFailed).toBe(true);
    });

    it('records synthesis error but continues pipeline', async () => {
      const failingSynthesizer = makeSynthesizer({
        synthesize: vi.fn<() => Promise<SynthesisResult>>().mockRejectedValue(new Error('LLM timeout')),
      });
      const decisionAdapter = makeDecisionAdapter();

      const result = await mull(REF, {
        adapters: [decisionAdapter],
        synthesizer: failingSynthesizer,
        topicStore,
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.stage).toBe('synthesize');
      expect(result.errors[0]!.recoverable).toBe(true);

      // Merge and TOC still ran despite LLM failure
      expect(topicStore.merge).toHaveBeenCalledOnce();
      expect(topicStore.rebuildToc).toHaveBeenCalledOnce();
      // Cursor was still advanced
      expect(decisionAdapter.setCursor).toHaveBeenCalledWith(REF, 'msg-2');
    });

    it('trail decision nuggets have structured confidence (0.8)', async () => {
      const failingSynthesizer = makeSynthesizer({
        synthesize: vi.fn<() => Promise<SynthesisResult>>().mockRejectedValue(new Error('LLM timeout')),
      });

      await mull(REF, {
        adapters: [makeDecisionAdapter()],
        synthesizer: failingSynthesizer,
        topicStore,
      });

      // Verify the nuggets passed to merge have structured decision confidence
      const mergeCall = (topicStore.merge as ReturnType<typeof vi.fn>).mock.calls[0];
      const nuggets = mergeCall![0] as Nugget[];
      expect(nuggets).toHaveLength(2);
      for (const nugget of nuggets) {
        expect(nugget.confidence).toBe(0.8); // default for pre-structured decisions
        expect(nugget.category).toBe('Decisions');
      }
    });

    it('trail decision nuggets preserve decision descriptions', async () => {
      const failingSynthesizer = makeSynthesizer({
        synthesize: vi.fn<() => Promise<SynthesisResult>>().mockRejectedValue(new Error('LLM timeout')),
      });

      await mull(REF, {
        adapters: [makeDecisionAdapter()],
        synthesizer: failingSynthesizer,
        topicStore,
      });

      const mergeCall = (topicStore.merge as ReturnType<typeof vi.fn>).mock.calls[0];
      const nuggets = mergeCall![0] as Nugget[];
      const contents = nuggets.map(n => n.content);
      expect(contents).toContain('Use OAuth 2.0 with PKCE for auth');
      expect(contents).toContain('Use SQLite for local storage');
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency: two runs with same data produce identical topic file content
  // -------------------------------------------------------------------------

  describe('idempotency', () => {
    it('two runs with same data produce identical topic file content', async () => {
      const tempDir1 = mkdtempSync(join(tmpdir(), 'mull-idem-1-'));
      const tempDir2 = mkdtempSync(join(tmpdir(), 'mull-idem-2-'));
      const realTopicStore = new FileTopicStore();
      const deterministicSynth = makeDeterministicSynthesizer();

      const sessionData: SessionData = {
        ref: REF,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello world', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: '2026-01-01T00:01:00Z' },
        ],
      };

      const idempotentAdapter = makeAdapter({
        loadSession: vi.fn<() => Promise<SessionData>>().mockResolvedValue(sessionData),
        getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
        setCursor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      });

      // Run 1
      await mull(REF, {
        adapters: [idempotentAdapter],
        synthesizer: deterministicSynth,
        topicStore: realTopicStore,
        config: { memoryDir: tempDir1 },
      });

      // Run 2 with identical input
      await mull(REF, {
        adapters: [idempotentAdapter],
        synthesizer: deterministicSynth,
        topicStore: realTopicStore,
        config: { memoryDir: tempDir2 },
      });

      // Compare topic file contents
      const file1 = readFileSync(join(tempDir1, 'general.md'), 'utf-8');
      const file2 = readFileSync(join(tempDir2, 'general.md'), 'utf-8');

      // Structural content is identical (nugget IDs differ due to UUID but
      // content, topic assignment, and structure match)
      // Extract just the content lines (skip nugget ID comments and updated timestamp)
      const contentLines = (text: string) =>
        text.split('\n').filter(l =>
          !l.startsWith('<!-- nugget:') && !l.startsWith("updated:")
        );

      expect(contentLines(file1)).toEqual(contentLines(file2));
    });

    it('re-run with same cursor state does not duplicate content', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'mull-idem-nodup-'));
      const realTopicStore = new FileTopicStore();
      const deterministicSynth = makeDeterministicSynthesizer();

      const sessionData: SessionData = {
        ref: REF,
        messages: [
          { id: 'msg-1', role: 'user', content: 'First message', timestamp: '2026-01-01T00:00:00Z' },
        ],
      };

      const noNewMessagesData: SessionData = {
        ref: REF,
        messages: [],
      };

      let callCount = 0;
      const cursorTrackingAdapter = makeAdapter({
        loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockImplementation(
          async (_ref, opts) => {
            callCount++;
            // Second call uses cursor — no new messages
            if (opts?.after === 'msg-1') return noNewMessagesData;
            return sessionData;
          }
        ),
        getCursor: vi.fn<() => Promise<string | null>>()
          .mockResolvedValueOnce(null)    // First run: no cursor
          .mockResolvedValueOnce('msg-1'), // Second run: cursor at msg-1
        setCursor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      });

      // Run 1: process messages
      const result1 = await mull(REF, {
        adapters: [cursorTrackingAdapter],
        synthesizer: deterministicSynth,
        topicStore: realTopicStore,
        config: { memoryDir: tempDir },
      });

      expect(result1.nuggetsWritten).toBe(1);

      // Run 2: cursor prevents reprocessing
      const result2 = await mull(REF, {
        adapters: [cursorTrackingAdapter],
        synthesizer: deterministicSynth,
        topicStore: realTopicStore,
        config: { memoryDir: tempDir },
      });

      expect(result2.nuggetsWritten).toBe(0);

      // Topic file has content from only one run
      const content = readFileSync(join(tempDir, 'general.md'), 'utf-8');
      const occurrences = content.split('First message').length - 1;
      expect(occurrences).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling edge cases
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('returns empty result when session has no messages', async () => {
      const emptyAdapter = makeAdapter({
        loadSession: vi.fn<() => Promise<SessionData>>().mockResolvedValue({
          ref: REF,
          messages: [],
        }),
      });

      const result = await mull(REF, {
        adapters: [emptyAdapter],
        synthesizer,
        topicStore,
      });

      expect(result.nuggetsWritten).toBe(0);
      expect(synthesizer.synthesize).not.toHaveBeenCalled();
    });

    it('handles load failure with non-recoverable error', async () => {
      const failingAdapter = makeAdapter({
        loadSession: vi.fn<() => Promise<SessionData>>().mockRejectedValue(new Error('DB connection lost')),
      });

      const result = await mull(REF, {
        adapters: [failingAdapter],
        synthesizer,
        topicStore,
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.stage).toBe('load');
      expect(result.errors[0]!.recoverable).toBe(false);
    });

    it('continues if TOC rebuild fails (non-fatal)', async () => {
      const failingTocStore = makeTopicStore({
        rebuildToc: vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Permission denied')),
      });

      const result = await mull(REF, {
        adapters: [adapter],
        synthesizer,
        topicStore: failingTocStore,
      });

      expect(result.nuggetsWritten).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.stage).toBe('toc');
      expect(result.errors[0]!.recoverable).toBe(true);
      expect(adapter.setCursor).toHaveBeenCalled();
    });

    it('continues if cursor update fails (non-fatal)', async () => {
      const failingCursorAdapter = makeAdapter({
        setCursor: vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Write failed')),
      });

      const result = await mull(REF, {
        adapters: [failingCursorAdapter],
        synthesizer,
        topicStore,
      });

      expect(result.nuggetsWritten).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.stage).toBe('cursor');
      expect(result.errors[0]!.recoverable).toBe(true);
    });

    it('handles cursor read failure gracefully (continues without cursor)', async () => {
      const brokenCursorAdapter = makeAdapter({
        getCursor: vi.fn<() => Promise<string | null>>().mockRejectedValue(new Error('Cursor DB corrupt')),
      });

      const result = await mull(REF, {
        adapters: [brokenCursorAdapter],
        synthesizer,
        topicStore,
      });

      // Should still process — loads without cursor filter
      expect(result.nuggetsWritten).toBe(2);
      // Records recoverable error
      expect(result.errors.some(e => e.stage === 'load' && e.recoverable)).toBe(true);
    });

    it('throws when no adapters are provided', async () => {
      await expect(
        mull(REF, { synthesizer, topicStore })
      ).rejects.toThrow(/No adapters provided/);
    });
  });
});
