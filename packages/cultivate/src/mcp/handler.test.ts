/**
 * Tests for the MCP tool call handler
 *
 * Covers:
 *  - Data tools: correct storage method called, correct args, response shape
 *  - AI-redirect tools: returns message with correct endpoint URL, no storage call
 *  - Error paths: unknown tool name, missing required arguments
 *  - Argument validation: limit capping for cultivate_list_signals
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleToolCall } from './handler.js';
import type { CultivateStorage } from '../storage/interface.js';

// ---------------------------------------------------------------------------
// Mock computeDemandScore so handler tests are not sensitive to scoring logic
// ---------------------------------------------------------------------------
vi.mock('../scoring/demand.js', () => ({
  computeDemandScore: vi.fn(() => ({ score: 42, label: 'medium', request_ratio: 0.5, velocity_factor: 0.5, quality_factor: 0.8 })),
}));

// ---------------------------------------------------------------------------
// Minimal fixture factories — only the fields the handler actually reads
// ---------------------------------------------------------------------------

function makeGreenhouse(id = 'gh-1') {
  return { id, name: 'Test Greenhouse' };
}

function makeCluster(id = 'cl-1', greenhouseId = 'gh-1') {
  return {
    id,
    greenhouse_id: greenhouseId,
    label: 'Auth issues',
    summary: 'Users struggling with auth',
    signal_count: 5,
    trend: 'rising' as const,
    velocity_weekly: 2,
    velocity_monthly: 8,
  };
}

function makeSignal(id = 'sig-1') {
  return { id, greenhouse_id: 'gh-1', title: 'Signal', score: 0.7 };
}

function makeProfile(id = 'prof-1') {
  return { id, greenhouse_id: 'gh-1', author: 'alice', signal_count: 3 };
}

// ---------------------------------------------------------------------------
// Storage mock — only the methods exercised by the handler
// ---------------------------------------------------------------------------

function makeStorage(overrides: Partial<CultivateStorage> = {}): CultivateStorage {
  return {
    // Data tools
    listGreenhouses: vi.fn(async () => [makeGreenhouse()]),
    listClustersByGreenhouse: vi.fn(async () => [makeCluster()]),
    getClusterById: vi.fn(async () => makeCluster()),
    listSignals: vi.fn(async () => [makeSignal()]),
    getExtractionBySignalId: vi.fn(async () => null),
    listProfiles: vi.fn(async () => [makeProfile()]),

    // Stub everything else so TypeScript is satisfied without a full implementation
    createSignal: vi.fn(),
    getSignalById: vi.fn(),
    getSignalByExternalId: vi.fn(),
    checkExactDuplicate: vi.fn(),
    updateSignal: vi.fn(),
    countSignalsByStatus: vi.fn(),
    createGreenhouse: vi.fn(),
    getGreenhouseById: vi.fn(),
    updateGreenhouse: vi.fn(),
    deleteGreenhouse: vi.fn(),
    createCluster: vi.fn(),
    getClusterByIdAndGreenhouse: vi.fn(),
    getClusterByLabel: vi.fn(),
    updateCluster: vi.fn(),
    deleteCluster: vi.fn(),
    createSourceConfig: vi.fn(),
    getSourceConfigById: vi.fn(),
    updateSourceConfig: vi.fn(),
    updateSourceHealth: vi.fn(),
    deleteSourceConfig: vi.fn(),
    listSourceConfigs: vi.fn(),
    createFilterRule: vi.fn(),
    getFilterRuleById: vi.fn(),
    updateFilterRule: vi.fn(),
    updateFilterEffectiveness: vi.fn(),
    deleteFilterRule: vi.fn(),
    listFilterRules: vi.fn(),
    createIngestionJob: vi.fn(),
    getIngestionJobById: vi.fn(),
    updateIngestionJob: vi.fn(),
    listIngestionJobs: vi.fn(),
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    storeExtraction: vi.fn(),
    upsertProfile: vi.fn(),
    getProfileById: vi.fn(),
    getProfilesByAuthors: vi.fn(),
    createSegment: vi.fn(),
    listSegments: vi.fn(),
    assignProfileSegment: vi.fn(),
    updateSegmentCount: vi.fn(),
    createReport: vi.fn(),
    getReportById: vi.fn(),
    listReports: vi.fn(),
    deleteReport: vi.fn(),
    ...overrides,
  } as unknown as CultivateStorage;
}

// ---------------------------------------------------------------------------
// Helper: extract the parsed JSON data from a ToolResult
// ---------------------------------------------------------------------------
function parseResult(result: { content: Array<{ type: 'text'; text: string }>; isError?: boolean }) {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleToolCall', () => {
  let storage: CultivateStorage;

  beforeEach(() => {
    storage = makeStorage();
  });

  // =========================================================================
  // cultivate_list_greenhouses
  // =========================================================================

  describe('cultivate_list_greenhouses', () => {
    it('calls listGreenhouses and returns results', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_greenhouses', {});

      expect(storage.listGreenhouses).toHaveBeenCalledOnce();
      expect(result.isError).toBeFalsy();

      const data = parseResult(result);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('gh-1');
    });

    it('does not call any other storage method', async () => {
      await handleToolCall(storage, 'cultivate_list_greenhouses', {});
      expect(storage.listClustersByGreenhouse).not.toHaveBeenCalled();
      expect(storage.listSignals).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // cultivate_list_clusters
  // =========================================================================

  describe('cultivate_list_clusters', () => {
    it('calls listClustersByGreenhouse with provided greenhouse_id', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_clusters', { greenhouse_id: 'gh-1' });

      expect(storage.listClustersByGreenhouse).toHaveBeenCalledWith('gh-1');
      expect(result.isError).toBeFalsy();

      const data = parseResult(result);
      expect(Array.isArray(data)).toBe(true);
    });

    it('sorts clusters by signal_count descending', async () => {
      const low = { ...makeCluster('cl-low'), signal_count: 2 };
      const high = { ...makeCluster('cl-high'), signal_count: 10 };
      vi.mocked(storage.listClustersByGreenhouse).mockResolvedValueOnce([low, high]);

      const result = await handleToolCall(storage, 'cultivate_list_clusters', { greenhouse_id: 'gh-1' });
      const data = parseResult(result) as Array<{ id: string; signal_count: number }>;

      expect(data[0].id).toBe('cl-high');
      expect(data[1].id).toBe('cl-low');
    });

    it('returns error when greenhouse_id is missing', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_clusters', {});

      expect(result.isError).toBe(true);
      expect(parseResult(result).error).toMatch(/greenhouse_id/i);
      expect(storage.listClustersByGreenhouse).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // cultivate_get_cluster
  // =========================================================================

  describe('cultivate_get_cluster', () => {
    it('fetches cluster, its signals, and enriches with extractions and demand score', async () => {
      const signal = makeSignal();
      const cluster = makeCluster();
      vi.mocked(storage.getClusterById).mockResolvedValueOnce(cluster);
      vi.mocked(storage.listSignals).mockResolvedValueOnce([signal]);
      vi.mocked(storage.getExtractionBySignalId).mockResolvedValueOnce(null);

      const result = await handleToolCall(storage, 'cultivate_get_cluster', { cluster_id: 'cl-1' });

      expect(storage.getClusterById).toHaveBeenCalledWith('cl-1');
      expect(storage.listSignals).toHaveBeenCalledWith({
        cluster_id: cluster.id,
        limit: 100,
        offset: 0,
      });
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith(signal.id);

      expect(result.isError).toBeFalsy();
      const data = parseResult(result);
      expect(data.id).toBe('cl-1');
      expect(Array.isArray(data.signals)).toBe(true);
      expect(data.signals[0].id).toBe(signal.id);
      expect(data.demand).toBeDefined();
      expect(typeof data.demand.score).toBe('number');
    });

    it('returns error when cluster_id is missing', async () => {
      const result = await handleToolCall(storage, 'cultivate_get_cluster', {});

      expect(result.isError).toBe(true);
      expect(parseResult(result).error).toMatch(/cluster_id/i);
      expect(storage.getClusterById).not.toHaveBeenCalled();
    });

    it('returns error when cluster is not found', async () => {
      vi.mocked(storage.getClusterById).mockResolvedValueOnce(null);

      const result = await handleToolCall(storage, 'cultivate_get_cluster', { cluster_id: 'missing' });

      expect(result.isError).toBe(true);
      expect(parseResult(result).error).toMatch(/not found/i);
    });

    it('calls getExtractionBySignalId once per signal', async () => {
      const signals = [makeSignal('sig-1'), makeSignal('sig-2'), makeSignal('sig-3')];
      vi.mocked(storage.getClusterById).mockResolvedValueOnce(makeCluster());
      vi.mocked(storage.listSignals).mockResolvedValueOnce(signals);

      await handleToolCall(storage, 'cultivate_get_cluster', { cluster_id: 'cl-1' });

      expect(storage.getExtractionBySignalId).toHaveBeenCalledTimes(3);
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith('sig-1');
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith('sig-2');
      expect(storage.getExtractionBySignalId).toHaveBeenCalledWith('sig-3');
    });
  });

  // =========================================================================
  // cultivate_list_signals
  // =========================================================================

  describe('cultivate_list_signals', () => {
    it('passes optional filters through to listSignals', async () => {
      await handleToolCall(storage, 'cultivate_list_signals', {
        greenhouse_id: 'gh-1',
        intent: 'feature_request',
        cluster_id: 'cl-1',
        limit: 20,
      });

      expect(storage.listSignals).toHaveBeenCalledWith({
        greenhouse_id: 'gh-1',
        intent: 'feature_request',
        cluster_id: 'cl-1',
        limit: 20,
        offset: 0,
      });
    });

    it('defaults limit to 50 when not provided', async () => {
      await handleToolCall(storage, 'cultivate_list_signals', {});

      const call = vi.mocked(storage.listSignals).mock.calls[0][0];
      expect(call.limit).toBe(50);
    });

    it('caps limit at 100 when a higher value is given', async () => {
      await handleToolCall(storage, 'cultivate_list_signals', { limit: 999 });

      const call = vi.mocked(storage.listSignals).mock.calls[0][0];
      expect(call.limit).toBe(100);
    });

    it('clamps limit to minimum of 1 when zero or negative is given', async () => {
      await handleToolCall(storage, 'cultivate_list_signals', { limit: 0 });
      const callZero = vi.mocked(storage.listSignals).mock.calls[0][0];
      expect(callZero.limit).toBe(1);

      vi.mocked(storage.listSignals).mockClear();

      await handleToolCall(storage, 'cultivate_list_signals', { limit: -10 });
      const callNeg = vi.mocked(storage.listSignals).mock.calls[0][0];
      expect(callNeg.limit).toBe(1);
    });

    it('ignores non-numeric limit and falls back to 50', async () => {
      await handleToolCall(storage, 'cultivate_list_signals', { limit: 'lots' });

      const call = vi.mocked(storage.listSignals).mock.calls[0][0];
      expect(call.limit).toBe(50);
    });

    it('always sends offset 0', async () => {
      await handleToolCall(storage, 'cultivate_list_signals', { limit: 10 });

      const call = vi.mocked(storage.listSignals).mock.calls[0][0];
      expect(call.offset).toBe(0);
    });

    it('returns the signal list from storage', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_signals', {});

      expect(result.isError).toBeFalsy();
      const data = parseResult(result);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('sig-1');
    });
  });

  // =========================================================================
  // cultivate_list_profiles
  // =========================================================================

  describe('cultivate_list_profiles', () => {
    it('calls listProfiles with greenhouse_id and optional segment', async () => {
      await handleToolCall(storage, 'cultivate_list_profiles', {
        greenhouse_id: 'gh-1',
        segment: 'power-user',
      });

      expect(storage.listProfiles).toHaveBeenCalledWith({
        greenhouse_id: 'gh-1',
        segment: 'power-user',
        limit: 100,
        offset: 0,
      });
    });

    it('omits segment when not provided', async () => {
      await handleToolCall(storage, 'cultivate_list_profiles', { greenhouse_id: 'gh-1' });

      const call = vi.mocked(storage.listProfiles).mock.calls[0][0];
      expect(call.segment).toBeUndefined();
    });

    it('returns error when greenhouse_id is missing', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_profiles', {});

      expect(result.isError).toBe(true);
      expect(parseResult(result).error).toMatch(/greenhouse_id/i);
      expect(storage.listProfiles).not.toHaveBeenCalled();
    });

    it('returns profile list from storage', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_profiles', { greenhouse_id: 'gh-1' });

      expect(result.isError).toBeFalsy();
      const data = parseResult(result);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('prof-1');
    });
  });

  // =========================================================================
  // AI-redirect tools
  // =========================================================================

  describe('AI-redirect tools', () => {
    it('cultivate_get_recommendations returns redirect message with correct endpoint', async () => {
      const result = await handleToolCall(storage, 'cultivate_get_recommendations', {});

      expect(result.isError).toBeFalsy();
      const data = parseResult(result);
      expect(data.message).toContain('GET /api/cultivate/recommendations');
      expect(data.message).toMatch(/greenhouse_id/);
    });

    it('cultivate_generate_prd returns redirect message with correct endpoint', async () => {
      const result = await handleToolCall(storage, 'cultivate_generate_prd', {});

      expect(result.isError).toBeFalsy();
      const data = parseResult(result);
      expect(data.message).toContain('POST /api/cultivate/prd/generate');
      expect(data.message).toMatch(/cluster_id/);
    });

    it('cultivate_generate_report returns redirect message with correct endpoint', async () => {
      const result = await handleToolCall(storage, 'cultivate_generate_report', {});

      expect(result.isError).toBeFalsy();
      const data = parseResult(result);
      expect(data.message).toContain('POST /api/cultivate/reports/generate');
      expect(data.message).toMatch(/greenhouse_id/);
    });

    it('AI-redirect tools do not call any storage method', async () => {
      const aiTools = ['cultivate_get_recommendations', 'cultivate_generate_prd', 'cultivate_generate_report'];
      for (const tool of aiTools) {
        const localStorage = makeStorage();
        await handleToolCall(localStorage, tool, {});

        expect(localStorage.listGreenhouses).not.toHaveBeenCalled();
        expect(localStorage.listClustersByGreenhouse).not.toHaveBeenCalled();
        expect(localStorage.getClusterById).not.toHaveBeenCalled();
        expect(localStorage.listSignals).not.toHaveBeenCalled();
        expect(localStorage.listProfiles).not.toHaveBeenCalled();
      }
    });
  });

  // =========================================================================
  // Unknown tool
  // =========================================================================

  describe('unknown tool name', () => {
    it('returns an error result for an unrecognised tool', async () => {
      const result = await handleToolCall(storage, 'cultivate_does_not_exist', {});

      expect(result.isError).toBe(true);
      const data = parseResult(result);
      expect(data.error).toContain('cultivate_does_not_exist');
    });

    it('does not call any storage methods for an unknown tool', async () => {
      await handleToolCall(storage, 'totally_unknown', {});

      expect(storage.listGreenhouses).not.toHaveBeenCalled();
      expect(storage.listClustersByGreenhouse).not.toHaveBeenCalled();
      expect(storage.listSignals).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ToolResult shape invariants
  // =========================================================================

  describe('ToolResult shape', () => {
    it('success results have content array with a single text entry', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_greenhouses', {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
      expect(result.isError).toBeFalsy();
    });

    it('error results have isError=true and a JSON error field', async () => {
      const result = await handleToolCall(storage, 'cultivate_list_clusters', {});

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      const data = parseResult(result);
      expect(data).toHaveProperty('error');
    });

    it('text content is valid JSON for all success paths', async () => {
      const successCases: Array<[string, Record<string, unknown>]> = [
        ['cultivate_list_greenhouses', {}],
        ['cultivate_list_clusters', { greenhouse_id: 'gh-1' }],
        ['cultivate_get_cluster', { cluster_id: 'cl-1' }],
        ['cultivate_list_signals', {}],
        ['cultivate_list_profiles', { greenhouse_id: 'gh-1' }],
        ['cultivate_get_recommendations', {}],
        ['cultivate_generate_prd', {}],
        ['cultivate_generate_report', {}],
      ];

      for (const [tool, args] of successCases) {
        const result = await handleToolCall(storage, tool, args);
        expect(() => JSON.parse(result.content[0].text), `${tool} text should be valid JSON`).not.toThrow();
      }
    });
  });
});
