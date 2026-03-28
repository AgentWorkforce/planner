/**
 * Pipeline orchestrator tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProcessSignalContext } from './types.js';
import { SignalFilteredError } from '../errors.js';
import type { NormalizedEvent, Greenhouse, ExtractionResult } from '../domain/types.js';
import type { CultivateConfig } from '../types.js';

// Top-level mocks — vi.mock() is hoisted by Vitest, so factory functions
// must NOT reference variables declared later in the file.
vi.mock('../extraction/index.js', () => ({
  extractSignal: vi.fn(),
}));

vi.mock('../clustering/index.js', () => ({
  assignCluster: vi.fn(),
  createCluster: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

// Import after mocking — these resolve to the mocked versions
import { processSignal } from './index.js';
import { extractSignal } from '../extraction/index.js';
import { assignCluster, createCluster } from '../clustering/index.js';

describe('Pipeline Orchestrator', () => {
  const mockGreenhouse: Greenhouse = {
    id: 'gh-test',
    name: 'Test Greenhouse',
    description: 'Test greenhouse for pipeline tests',
    mode: 'refinement',
    keyword_require: ['api', 'performance'],
    keyword_exclude: ['spam'],
    source_ids: [],
    created_at: '2026-02-14T10:00:00Z',
    updated_at: '2026-02-14T10:00:00Z',
  };

  const mockSignal: NormalizedEvent = {
    title: 'API Performance Issue',
    body: 'The API is responding slowly on production',
    author: 'John Doe',
    author_type: 'user',
    source_type: 'webhook',
    external_id: 'sig-test-123',
    occurred_at: '2026-02-14T12:00:00Z',
    url: 'https://example.com/issues/123',
  };

  const mockConfig: CultivateConfig = {
    weights: {
      [mockGreenhouse.id]: {
        recency: 0.15,
        specificity: 0.15,
        source_authority: 0.10,
        repetition: 0.10,
        emotional_intensity: 0.10,
        strategic_fit: 0.20,
        actionability: 0.15,
        content_quality: 0.05,
      },
    },
    filter_rules: {
      'test-rule': { enabled: true },
    },
    tier1_strictness: 0.5,
    tier2_enabled: false,
    tier2_threshold: 0.3,
  };

  const mockExtractionResult: ExtractionResult = {
    summary: 'API performance degradation on production',
    keywords: ['API', 'performance', 'slow', 'production'],
    entities: [
      { name: 'API', type: 'SYSTEM' },
      { name: 'production', type: 'ENVIRONMENT' },
    ],
    aspects: ['performance', 'reliability'],
    quotes: ['The API is responding slowly'],
    reasoning: 'User reporting production API performance issue',
    specificity: 0.8,
    emotional_intensity: 0.6,
    actionability: 0.9,
  };

  let mockStorage: any;
  let mockFilterRegistry: any;
  let mockBroadcaster: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock storage
    mockStorage = {
      getConfig: vi.fn().mockResolvedValue(mockConfig),
      checkExactDuplicate: vi.fn().mockResolvedValue(null),
      listClustersByGreenhouse: vi.fn().mockResolvedValue([]),
      createCluster: vi.fn().mockResolvedValue({
        id: 'cluster-new',
        greenhouse_id: mockGreenhouse.id,
        label: 'API Performance',
        summary: 'Cluster for API performance issues',
        signal_count: 1,
        trend: 'stable',
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: '2026-02-14T12:00:00Z',
        updated_at: '2026-02-14T12:00:00Z',
      }),
      createSignal: vi.fn().mockResolvedValue({
        id: 'sig-stored-123',
        greenhouse_id: mockGreenhouse.id,
        source_type: 'webhook',
        external_id: 'sig-test-123',
        title: mockSignal.title,
        body: mockSignal.body,
        author: mockSignal.author,
        author_type: mockSignal.author_type,
        url: mockSignal.url,
        score: 0.75,
        scoring_factors: {},
        status: 'clustered',
        provenance: [],
        tags: [],
        created_at: '2026-02-14T12:00:00Z',
        updated_at: '2026-02-14T12:00:00Z',
      }),
      updateSignal: vi.fn().mockResolvedValue({}),
      storeExtraction: vi.fn().mockResolvedValue({}),
      getClusterByIdAndGreenhouse: vi.fn().mockResolvedValue(null),
    };

    // Mock filter registry
    mockFilterRegistry = {
      execute: vi.fn().mockReturnValue({
        passed: true,
        score_adjustment: 0,
      }),
    };

    // Mock SSE broadcaster
    mockBroadcaster = {
      emitSignalNew: vi.fn(),
    };

    // Set default mock implementations for mocked modules
    vi.mocked(extractSignal).mockResolvedValue(mockExtractionResult);
    vi.mocked(assignCluster).mockResolvedValue({
      cluster_id: 'cluster-new',
      isNew: true,
      decision: {
        action: 'create',
        cluster_label: 'API Performance',
        reasoning: 'New cluster for API performance issues',
      },
    });
    vi.mocked(createCluster).mockResolvedValue({} as any);

    // Mock environment variable for Anthropic API key
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  });

  it('should successfully process a signal through all 7 stages', async () => {
    const ctx: ProcessSignalContext = {
      signal: mockSignal,
      greenhouse: mockGreenhouse,
      config: mockConfig,
      storage: mockStorage,
      broadcaster: mockBroadcaster,
      filterRegistry: mockFilterRegistry,
      provenance: [],
    };

    const result = await processSignal(ctx);

    // Verify all stages completed
    expect(result.provenance).toHaveLength(7);
    expect(result.provenance[0].step).toBe('filter');
    expect(result.provenance[1].step).toBe('extract');
    expect(result.provenance[2].step).toBe('score');
    expect(result.provenance[3].step).toBe('dedup');
    expect(result.provenance[4].step).toBe('cluster');
    expect(result.provenance[5].step).toBe('store');
    expect(result.provenance[6].step).toBe('sse');

    // Verify all stages passed
    result.provenance.forEach((p) => {
      expect(p.outcome).toBe('passed');
    });

    // Verify results
    expect(result.filterResult).toBeDefined();
    expect(result.extractionResult).toBeDefined();
    expect(result.scoringResult).toBeDefined();
    expect(result.dedupResult).toBeDefined();
    expect(result.clusterResult).toBeDefined();
    expect(result.storedSignalId).toBeDefined();
  });

  it('should stop pipeline early when filter rejects signal', async () => {
    // Mock filter rejection
    mockFilterRegistry.execute.mockReturnValue({
      passed: false,
      rejection_rule: 'spam-filter',
      rejection_reason: 'Signal matched spam pattern',
    });

    const ctx: ProcessSignalContext = {
      signal: mockSignal,
      greenhouse: mockGreenhouse,
      config: mockConfig,
      storage: mockStorage,
      broadcaster: mockBroadcaster,
      filterRegistry: mockFilterRegistry,
      provenance: [],
    };

    await expect(processSignal(ctx)).rejects.toThrow(SignalFilteredError);

    // Verify only filter stage ran
    expect(ctx.provenance).toHaveLength(1);
    expect(ctx.provenance[0].step).toBe('filter');
    expect(ctx.provenance[0].outcome).toBe('failed');
    expect(ctx.provenance[0].reason).toContain('Rejected at Tier');
  });

  it('should stop pipeline when exact duplicate detected', async () => {
    // Mock exact duplicate detection
    mockStorage.checkExactDuplicate.mockResolvedValue('sig-existing-456');

    const ctx: ProcessSignalContext = {
      signal: mockSignal,
      greenhouse: mockGreenhouse,
      config: mockConfig,
      storage: mockStorage,
      broadcaster: mockBroadcaster,
      filterRegistry: mockFilterRegistry,
      provenance: [],
    };

    const result = await processSignal(ctx);

    // Verify pipeline stopped after dedup
    expect(result.provenance.length).toBeLessThanOrEqual(4);

    // Find dedup stage
    const dedupStage = result.provenance.find((p) => p.step === 'dedup');
    expect(dedupStage).toBeDefined();
    expect(dedupStage!.outcome).toBe('failed');
    expect(dedupStage!.reason).toContain('Exact duplicate');

    // Verify dedup result
    expect(result.dedupResult).toEqual({
      isDuplicate: true,
      existingSignalId: 'sig-existing-456',
    });

    // Verify clustering and storage did NOT run
    expect(result.clusterResult).toBeUndefined();
    expect(result.storedSignalId).toBeUndefined();
  });

  it('should record provenance for each stage with timestamps', async () => {
    // Override cluster mock to return existing cluster (no create needed)
    vi.mocked(assignCluster).mockResolvedValue({
      cluster_id: 'cluster-123',
      isNew: false,
      decision: {
        action: 'assign',
      },
    });

    const ctx: ProcessSignalContext = {
      signal: mockSignal,
      greenhouse: mockGreenhouse,
      config: mockConfig,
      storage: mockStorage,
      broadcaster: mockBroadcaster,
      filterRegistry: mockFilterRegistry,
      provenance: [],
    };

    const result = await processSignal(ctx);

    // Verify provenance structure
    result.provenance.forEach((p) => {
      expect(p.step).toBeTruthy();
      expect(p.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(p.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(['passed', 'failed', 'skipped']).toContain(p.outcome);

      // Verify timestamps are ordered (completed_at >= started_at)
      expect(new Date(p.completed_at).getTime()).toBeGreaterThanOrEqual(
        new Date(p.started_at).getTime()
      );
    });
  });

  it('should emit SSE event on successful processing', async () => {
    // Override cluster mock to return existing cluster
    vi.mocked(assignCluster).mockResolvedValue({
      cluster_id: 'cluster-123',
      isNew: false,
      decision: {
        action: 'assign',
      },
    });

    const ctx: ProcessSignalContext = {
      signal: mockSignal,
      greenhouse: mockGreenhouse,
      config: mockConfig,
      storage: mockStorage,
      broadcaster: mockBroadcaster,
      filterRegistry: mockFilterRegistry,
      provenance: [],
    };

    await processSignal(ctx);

    // Verify SSE event was emitted
    expect(mockBroadcaster.emitSignalNew).toHaveBeenCalledWith({
      signal_id: 'sig-stored-123',
      greenhouse_id: mockGreenhouse.id,
      cluster_id: 'cluster-123',
      score: expect.any(Number),
      title: mockSignal.title,
    });
  });
});
