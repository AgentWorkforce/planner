/**
 * Tests for the synthesis report generator.
 *
 * Covers buildTemplateReport behavior via generateReport with no API key,
 * cluster filtering logic, edge cases, and storage integration.
 * AI summary path (requires Anthropic API) is not tested here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateReport } from './generator.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { Cluster, Signal, ExtractionResult } from '../domain/types.js';
import type { SynthesisReport } from '../domain/report-types.js';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: 'cluster-1',
    greenhouse_id: 'gh-1',
    label: 'API Performance',
    summary: 'Users reporting API slowdowns and timeouts',
    signal_count: 10,
    trend: 'rising',
    velocity_weekly: 5,
    velocity_monthly: 18,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-1',
    greenhouse_id: 'gh-1',
    cluster_id: 'cluster-1',
    source_type: 'webhook',
    external_id: 'ext-1',
    title: 'API response degraded after v2.3',
    body: 'Experiencing slow responses on all endpoints.',
    author: 'user1',
    author_type: 'user',
    score: 0.8,
    scoring_factors: {
      recency: 0.9,
      specificity: 0.8,
      source_authority: 0.85,
      repetition: 0.7,
      emotional_intensity: 0.6,
      strategic_fit: 0.9,
      actionability: 0.85,
      content_quality: 0.8,
    },
    status: 'clustered',
    intent: 'feature_request',
    provenance: [],
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    summary: 'API is slow',
    keywords: ['api', 'performance'],
    entities: [],
    aspects: ['latency', 'timeout'],
    quotes: ['The API is unbearably slow', 'Every request times out'],
    questions: [
      { text: 'When will the API be fixed?', is_explicit: true },
      { text: 'Is there a workaround?', is_explicit: false },
    ],
    reasoning: 'User is frustrated by API performance.',
    specificity: 0.8,
    emotional_intensity: 0.7,
    actionability: 0.9,
    sentiment: 'frustrated',
    ...overrides,
  };
}

function makeReport(overrides: Partial<SynthesisReport> = {}): SynthesisReport {
  return {
    id: 'report-1',
    greenhouse_id: 'gh-1',
    title: 'Test Greenhouse — Synthesis Report',
    report_type: 'custom',
    cluster_ids: ['cluster-1'],
    markdown_content: '# Test Report',
    metadata: { cluster_count: 1, total_signals: 2 },
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock storage builder
// ---------------------------------------------------------------------------

interface MockStorageConfig {
  clusters?: Cluster[];
  signalsByClusterId?: Record<string, Signal[]>;
  extractionBySignalId?: Record<string, ExtractionResult | null>;
  createdReport?: SynthesisReport;
}

function createMockStorage(config: MockStorageConfig = {}): CultivateStorage {
  const {
    clusters = [],
    signalsByClusterId = {},
    extractionBySignalId = {},
    createdReport,
  } = config;

  const reportToReturn = createdReport ?? makeReport();

  return {
    getGreenhouseById: vi.fn(async () => ({
      id: 'gh-1',
      name: 'Test Greenhouse',
      description: 'A test greenhouse',
      mode: 'discovery' as const,
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    listClustersByGreenhouse: vi.fn(async () => clusters),
    listSignals: vi.fn(async (filters) => {
      return signalsByClusterId[filters.cluster_id ?? ''] ?? [];
    }),
    getExtractionBySignalId: vi.fn(async (signal_id: string) => {
      if (signal_id in extractionBySignalId) {
        return extractionBySignalId[signal_id];
      }
      return null;
    }),
    createReport: vi.fn(async () => reportToReturn),
  } as unknown as CultivateStorage;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateReport', () => {
  let storage: CultivateStorage;

  // -------------------------------------------------------------------------
  // Template report generation (no AI)
  // -------------------------------------------------------------------------

  describe('template report generation (no AI key)', () => {
    beforeEach(() => {
      const cluster = makeCluster();
      const sig1 = makeSignal({ id: 'sig-1', cluster_id: 'cluster-1' });
      const sig2 = makeSignal({
        id: 'sig-2',
        cluster_id: 'cluster-1',
        author: 'user2',
        external_id: 'ext-2',
      });

      storage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: {
          'cluster-1': [sig1, sig2],
        },
        extractionBySignalId: {
          'sig-1': makeExtraction({
            sentiment: 'frustrated',
            quotes: ['The API is painfully slow'],
            questions: [{ text: 'When will this be fixed?', is_explicit: true }],
          }),
          'sig-2': makeExtraction({
            sentiment: 'hopeful',
            quotes: ['Things have improved slightly'],
            questions: [{ text: 'Is there a status page?', is_explicit: false }],
          }),
        },
        createdReport: makeReport({
          markdown_content: '# placeholder — real content set by createReport mock capture',
        }),
      });
    });

    it('generates report with correct title and greenhouse name in markdown', async () => {
      const report = await generateReport(storage, {
        greenhouse_id: 'gh-1',
        title: 'My Custom Report',
      });

      // createReport is called with markdown_content; capture what was passed
      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.title).toBe('My Custom Report');
      expect(createReportCall.markdown_content).toContain('# My Custom Report');
      expect(createReportCall.markdown_content).toContain('Test Greenhouse');
    });

    it('uses default title derived from greenhouse name when none provided', async () => {
      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.title).toBe('Test Greenhouse — Synthesis Report');
    });

    it('includes signal overview section with correct counts', async () => {
      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('## Signal Overview');
      expect(markdown_content).toContain('**Total signals**: 2');
      expect(markdown_content).toContain('**Clusters analyzed**: 1');
    });

    it('includes top themes section with cluster label and summary', async () => {
      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('## Top Themes');
      expect(markdown_content).toContain('### API Performance');
      expect(markdown_content).toContain('Users reporting API slowdowns and timeouts');
    });

    it('includes key questions section and deduplicates across signals', async () => {
      // Two signals, each with the same question text — should appear once
      const cluster = makeCluster();
      const sig1 = makeSignal({ id: 'sig-1', cluster_id: 'cluster-1' });
      const sig2 = makeSignal({ id: 'sig-2', cluster_id: 'cluster-1' });

      const dupStorage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: { 'cluster-1': [sig1, sig2] },
        extractionBySignalId: {
          'sig-1': makeExtraction({
            questions: [{ text: 'Is there a workaround?', is_explicit: true }],
          }),
          'sig-2': makeExtraction({
            questions: [{ text: 'Is there a workaround?', is_explicit: true }],
          }),
        },
      });

      await generateReport(dupStorage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(dupStorage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('## Key Questions');

      // Count occurrences of the question text
      const occurrences = (markdown_content.match(/Is there a workaround\?/g) ?? []).length;
      expect(occurrences).toBe(1);
    });

    it('includes sentiment overview with distribution percentages', async () => {
      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('## Sentiment Overview');
      // One frustrated + one hopeful → each 50%
      expect(markdown_content).toContain('frustrated');
      expect(markdown_content).toContain('hopeful');
      expect(markdown_content).toContain('50%');
    });

    it('includes notable quotes section', async () => {
      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('## Notable Quotes');
      expect(markdown_content).toContain('"The API is painfully slow"');
    });

    it('includes recommendations section for high and medium demand clusters', async () => {
      // Force a high-demand cluster: high velocity + all signals are feature_requests
      const cluster = makeCluster({
        id: 'cluster-high',
        label: 'High Demand Feature',
        velocity_weekly: 5,
        signal_count: 5,
      });

      const signals = Array.from({ length: 5 }, (_, i) =>
        makeSignal({
          id: `sig-${i}`,
          cluster_id: 'cluster-high',
          score: 1.0,
          intent: 'feature_request',
        }),
      );

      const extractions: Record<string, ExtractionResult> = {};
      for (const sig of signals) {
        extractions[sig.id] = makeExtraction({ sentiment: 'hopeful' });
      }

      const highDemandStorage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: { 'cluster-high': signals },
        extractionBySignalId: extractions,
      });

      await generateReport(highDemandStorage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(highDemandStorage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('## Recommendations');
    });
  });

  // -------------------------------------------------------------------------
  // Cluster filtering
  // -------------------------------------------------------------------------

  describe('cluster filtering', () => {
    beforeEach(() => {
      const clusters = [
        makeCluster({ id: 'cluster-1', label: 'Alpha' }),
        makeCluster({ id: 'cluster-2', label: 'Beta' }),
        makeCluster({ id: 'cluster-3', label: 'Gamma' }),
      ];

      storage = createMockStorage({
        clusters,
        signalsByClusterId: {
          'cluster-1': [makeSignal({ id: 'sig-1', cluster_id: 'cluster-1' })],
          'cluster-2': [makeSignal({ id: 'sig-2', cluster_id: 'cluster-2' })],
          'cluster-3': [makeSignal({ id: 'sig-3', cluster_id: 'cluster-3' })],
        },
      });
    });

    it('filters to only specified cluster_ids when provided', async () => {
      await generateReport(storage, {
        greenhouse_id: 'gh-1',
        cluster_ids: ['cluster-1', 'cluster-3'],
      });

      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.cluster_ids).toEqual(
        expect.arrayContaining(['cluster-1', 'cluster-3']),
      );
      expect(createReportCall.cluster_ids).not.toContain('cluster-2');
      expect(createReportCall.markdown_content).toContain('Alpha');
      expect(createReportCall.markdown_content).toContain('Gamma');
      expect(createReportCall.markdown_content).not.toContain('Beta');
    });

    it('returns empty report (no clusters) when cluster_ids is an empty array', async () => {
      // This was a bug: empty array should mean "no clusters", not "all clusters"
      await generateReport(storage, {
        greenhouse_id: 'gh-1',
        cluster_ids: [],
      });

      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.cluster_ids).toHaveLength(0);
      expect(createReportCall.metadata).toMatchObject({ cluster_count: 0, total_signals: 0 });
    });

    it('returns all clusters when cluster_ids is not provided', async () => {
      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.cluster_ids).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('generates a valid report structure when there are no clusters', async () => {
      storage = createMockStorage({ clusters: [] });

      const report = await generateReport(storage, { greenhouse_id: 'gh-1' });

      expect(report).toBeDefined();

      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.markdown_content).toContain('## Signal Overview');
      expect(createReportCall.markdown_content).toContain('**Total signals**: 0');
      expect(createReportCall.markdown_content).toContain('**Clusters analyzed**: 0');
      // No themes, questions, sentiment, quotes sections when empty
      expect(createReportCall.markdown_content).not.toContain('## Top Themes');
    });

    it('handles signals with no extraction gracefully', async () => {
      const cluster = makeCluster();
      const sig = makeSignal({ id: 'sig-no-ext', cluster_id: 'cluster-1' });

      storage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: { 'cluster-1': [sig] },
        extractionBySignalId: { 'sig-no-ext': null },
      });

      // Should not throw — signals without extractions are skipped silently
      await expect(
        generateReport(storage, { greenhouse_id: 'gh-1' }),
      ).resolves.toBeDefined();

      const createReportCall = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(createReportCall.markdown_content).toContain('**Total signals**: 1');
      // No sentiment counted since no extraction
      expect(createReportCall.markdown_content).not.toContain('## Sentiment Overview');
    });

    it('generates a valid report for a single cluster with a single signal', async () => {
      const cluster = makeCluster({ id: 'c1', label: 'Solo Cluster' });
      const sig = makeSignal({ id: 's1', cluster_id: 'c1' });

      storage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: { c1: [sig] },
        extractionBySignalId: {
          s1: makeExtraction({
            quotes: ['Only quote here'],
            questions: [{ text: 'Single question?', is_explicit: true }],
            sentiment: 'neutral',
          }),
        },
      });

      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const { markdown_content } = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('Solo Cluster');
      expect(markdown_content).toContain('**Total signals**: 1');
      expect(markdown_content).toContain('Only quote here');
      expect(markdown_content).toContain('Single question?');
    });

    it('falls back to "Unknown Greenhouse" when greenhouse is not found', async () => {
      storage = createMockStorage({ clusters: [] });
      vi.mocked(storage.getGreenhouseById).mockResolvedValue(null);

      await generateReport(storage, { greenhouse_id: 'nonexistent' });

      const { markdown_content } = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(markdown_content).toContain('Unknown Greenhouse');
    });
  });

  // -------------------------------------------------------------------------
  // Report metadata
  // -------------------------------------------------------------------------

  describe('report metadata', () => {
    it('includes correct greenhouse_id, cluster_ids, and generated_at in createReport call', async () => {
      const cluster = makeCluster({ id: 'cl-a' });
      storage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: { 'cl-a': [makeSignal({ cluster_id: 'cl-a' })] },
      });

      const before = new Date().toISOString();
      await generateReport(storage, { greenhouse_id: 'gh-1' });
      const after = new Date().toISOString();

      const call = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(call.greenhouse_id).toBe('gh-1');
      expect(call.cluster_ids).toEqual(['cl-a']);
      expect(call.generated_at >= before).toBe(true);
      expect(call.generated_at <= after).toBe(true);
    });

    it('sets report_type to the provided value', async () => {
      storage = createMockStorage({ clusters: [] });

      await generateReport(storage, {
        greenhouse_id: 'gh-1',
        report_type: 'weekly',
      });

      const call = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(call.report_type).toBe('weekly');
    });

    it('defaults report_type to "custom" when not specified', async () => {
      storage = createMockStorage({ clusters: [] });

      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const call = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(call.report_type).toBe('custom');
    });

    it('sets metadata with correct cluster_count and total_signals', async () => {
      const clusters = [
        makeCluster({ id: 'c1', label: 'One' }),
        makeCluster({ id: 'c2', label: 'Two' }),
      ];
      storage = createMockStorage({
        clusters,
        signalsByClusterId: {
          c1: [makeSignal({ id: 's1', cluster_id: 'c1' }), makeSignal({ id: 's2', cluster_id: 'c1' })],
          c2: [makeSignal({ id: 's3', cluster_id: 'c2' })],
        },
      });

      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const call = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(call.metadata).toMatchObject({ cluster_count: 2, total_signals: 3 });
    });
  });

  // -------------------------------------------------------------------------
  // Storage integration
  // -------------------------------------------------------------------------

  describe('storage integration', () => {
    it('calls createReport with generated content and returns the persisted report', async () => {
      const expectedReport = makeReport({ id: 'persisted-report-id', title: 'Persisted' });

      storage = createMockStorage({
        clusters: [makeCluster()],
        signalsByClusterId: { 'cluster-1': [makeSignal()] },
        createdReport: expectedReport,
      });

      const result = await generateReport(storage, { greenhouse_id: 'gh-1' });

      expect(storage.createReport).toHaveBeenCalledOnce();
      // Returns exactly what createReport resolves with
      expect(result).toBe(expectedReport);
    });

    it('calls getExtractionBySignalId for each signal in the cluster', async () => {
      const cluster = makeCluster();
      const signals = [
        makeSignal({ id: 'sig-a', cluster_id: 'cluster-1' }),
        makeSignal({ id: 'sig-b', cluster_id: 'cluster-1' }),
        makeSignal({ id: 'sig-c', cluster_id: 'cluster-1' }),
      ];

      storage = createMockStorage({
        clusters: [cluster],
        signalsByClusterId: { 'cluster-1': signals },
        extractionBySignalId: {
          'sig-a': null,
          'sig-b': makeExtraction(),
          'sig-c': makeExtraction(),
        },
      });

      await generateReport(storage, { greenhouse_id: 'gh-1' });

      expect(storage.getExtractionBySignalId).toHaveBeenCalledTimes(3);
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith('sig-a');
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith('sig-b');
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith('sig-c');
    });

    it('does not call the Anthropic API when no API key is given', async () => {
      // No anthropicApiKey argument → AI path is skipped entirely.
      // We verify by ensuring createReport is still called (report completed)
      // and the markdown does NOT contain "Executive Summary".
      storage = createMockStorage({
        clusters: [makeCluster()],
        signalsByClusterId: { 'cluster-1': [makeSignal()] },
      });

      await generateReport(storage, { greenhouse_id: 'gh-1' });

      const call = vi.mocked(storage.createReport).mock.calls[0][0];
      expect(call.markdown_content).not.toContain('## Executive Summary');
    });
  });
});
