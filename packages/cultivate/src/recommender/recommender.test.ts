/**
 * Tests for RecommendationEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationEngine } from './index.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { Cluster, Signal } from '../domain/types.js';

// Mock storage
const createMockStorage = (): CultivateStorage => {
  const clusters: Cluster[] = [
    {
      id: 'cluster-1',
      greenhouse_id: 'gh-1',
      label: 'API Performance',
      summary: 'Users reporting API slowdowns and timeouts',
      signal_count: 15,
      trend: 'rising' as const,
      velocity_weekly: 5,
      velocity_monthly: 18,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cluster-2',
      greenhouse_id: 'gh-1',
      label: 'Onboarding UX',
      summary: 'New users confused by onboarding flow',
      signal_count: 8,
      trend: 'stable' as const,
      velocity_weekly: 1,
      velocity_monthly: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cluster-3',
      greenhouse_id: 'gh-1',
      label: 'Low Signal Cluster',
      summary: 'Only one signal',
      signal_count: 1, // Should be filtered out
      trend: 'stable' as const,
      velocity_weekly: 0,
      velocity_monthly: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const signals: Signal[] = [
    {
      id: 'sig-1',
      greenhouse_id: 'gh-1',
      cluster_id: 'cluster-1',
      source_type: 'webhook' as const,
      external_id: 'ext-1',
      title: 'API response time degraded after v2.3',
      body: 'Full body here',
      author: 'user1',
      author_type: 'user' as const,
      score: 0.85,
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
      status: 'clustered' as const,
      provenance: [],
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'sig-2',
      greenhouse_id: 'gh-1',
      cluster_id: 'cluster-1',
      source_type: 'webhook' as const,
      external_id: 'ext-2',
      title: 'Timeout errors on /api/users endpoint',
      body: 'Full body here',
      author: 'user2',
      author_type: 'user' as const,
      score: 0.78,
      scoring_factors: {
        recency: 0.8,
        specificity: 0.75,
        source_authority: 0.8,
        repetition: 0.7,
        emotional_intensity: 0.65,
        strategic_fit: 0.8,
        actionability: 0.75,
        content_quality: 0.75,
      },
      status: 'clustered' as const,
      provenance: [],
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  return {
    listClustersByGreenhouse: vi.fn(async () => clusters),
    listSignals: vi.fn(async (filters) => {
      return signals.filter(s => s.cluster_id === filters.cluster_id);
    }),
    getExtractionBySignalId: vi.fn(async () => null),
  } as any;
};

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockStorage: CultivateStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('should return empty recommendations without API key', async () => {
    engine = new RecommendationEngine(mockStorage, undefined);

    const recommendations = await engine.getRecommendations('gh-1');

    expect(recommendations).toEqual([]);
  });

  it('should filter clusters with signal_count < 2', async () => {
    engine = new RecommendationEngine(mockStorage, 'fake-key');

    // Mock Anthropic call to avoid actual API call
    const generateSpy = vi.spyOn(engine as any, 'callSonnetForRecommendations');
    generateSpy.mockResolvedValue([]);

    await engine.getRecommendations('gh-1');

    // Should have been called with only 2 clusters (cluster-3 filtered out)
    expect(generateSpy).toHaveBeenCalled();
    const callArgs = generateSpy.mock.calls[0][0];
    expect(callArgs).toHaveLength(2);
    expect(callArgs.map((c: Cluster) => c.id)).toEqual(['cluster-1', 'cluster-2']);
  });

  it('should rank clusters correctly', async () => {
    engine = new RecommendationEngine(mockStorage, 'fake-key');

    const clusters: Cluster[] = [
      {
        id: 'c1',
        signal_count: 10,
        velocity_weekly: 2,
      } as Cluster,
      {
        id: 'c2',
        signal_count: 15,
        velocity_weekly: 1,
      } as Cluster,
      {
        id: 'c3',
        signal_count: 5,
        velocity_weekly: 5,
      } as Cluster,
    ];

    const ranked = (engine as any).rankClusters(clusters);

    // c2: 15 * (1 + 1) = 30
    // c1: 10 * (1 + 2) = 30
    // c3: 5 * (1 + 5) = 30
    // All tied, but order should be stable
    expect(ranked.map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('should cache recommendations and return cached on subsequent calls', async () => {
    engine = new RecommendationEngine(mockStorage, 'fake-key');

    // Mock the Sonnet call to avoid actual API calls
    const callSonnetSpy = vi.spyOn(engine as any, 'callSonnetForRecommendations');
    callSonnetSpy.mockResolvedValue([
      {
        cluster_id: 'cluster-1',
        label: 'API Performance',
        rank: 1,
        summary: 'Fix API performance',
        evidence: ['sig-1'],
        confidence: 0.9,
      },
    ]);

    // First call - should generate (and call Sonnet)
    const result1 = await engine.getRecommendations('gh-1');
    expect(callSonnetSpy).toHaveBeenCalledTimes(1);
    expect(result1).toHaveLength(1);
    expect(result1[0].cluster_id).toBe('cluster-1');

    // Second call - should use cache (no additional Sonnet call)
    const result2 = await engine.getRecommendations('gh-1');
    expect(callSonnetSpy).toHaveBeenCalledTimes(1); // Still 1, not called again
    expect(result2).toEqual(result1); // Same result
  });

  it('should invalidate cache when requested', async () => {
    engine = new RecommendationEngine(mockStorage, 'fake-key');

    const callSonnetSpy = vi.spyOn(engine as any, 'callSonnetForRecommendations');
    callSonnetSpy.mockResolvedValue([
      {
        cluster_id: 'cluster-1',
        label: 'API Performance',
        rank: 1,
        summary: 'Fix API performance',
        evidence: ['sig-1'],
        confidence: 0.9,
      },
    ]);

    // Generate initial cache
    await engine.getRecommendations('gh-1');
    expect(callSonnetSpy).toHaveBeenCalledTimes(1);

    // Invalidate cache
    engine.invalidateCache('gh-1');

    // Next call should regenerate (call Sonnet again)
    await engine.getRecommendations('gh-1');
    expect(callSonnetSpy).toHaveBeenCalledTimes(2);
  });

  it('should return empty recommendations when no eligible clusters', async () => {
    const emptyStorage: CultivateStorage = {
      listClustersByGreenhouse: vi.fn(async () => []),
      listSignals: vi.fn(async () => []),
      getExtractionBySignalId: vi.fn(async () => null),
    } as any;

    engine = new RecommendationEngine(emptyStorage, 'fake-key');

    const recommendations = await engine.getRecommendations('gh-1');

    expect(recommendations).toEqual([]);
  });
});
