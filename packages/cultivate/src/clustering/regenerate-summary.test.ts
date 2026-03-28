/**
 * Tests for cluster summary regeneration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { regenerateSummary } from './regenerate-summary.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { Cluster, Signal } from '../domain/types.js';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk');

describe('regenerateSummary', () => {
  let mockStorage: CultivateStorage;
  let mockCluster: Cluster;
  let mockSignals: Signal[];

  beforeEach(() => {
    // Setup mock cluster
    mockCluster = {
      id: 'cluster-123',
      greenhouse_id: 'gh-456',
      label: 'API Performance',
      summary: 'Old summary about API performance issues',
      signal_count: 10,
      trend: 'rising',
      velocity_weekly: 2,
      velocity_monthly: 8,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
    };

    // Setup mock signals
    mockSignals = [
      {
        id: 'sig-1',
        greenhouse_id: 'gh-456',
        source_type: 'poll_api',
        external_id: 'ext-1',
        title: 'API response time degraded',
        body: 'Users reporting slow API responses in production environment',
        author: 'user123',
        author_type: 'user',
        score: 0.8,
        scoring_factors: {
          recency: 0.9,
          specificity: 0.7,
          source_authority: 0.6,
          repetition: 0.8,
          emotional_intensity: 0.5,
          strategic_fit: 0.9,
          actionability: 0.8,
          content_quality: 0.7,
        },
        cluster_id: 'cluster-123',
        status: 'clustered',
        provenance: [],
        tags: [],
        created_at: '2026-01-10T00:00:00Z',
        updated_at: '2026-01-10T00:00:00Z',
      },
      {
        id: 'sig-2',
        greenhouse_id: 'gh-456',
        source_type: 'poll_api',
        external_id: 'ext-2',
        title: 'Database queries taking too long',
        body: 'Multiple reports of database timeouts affecting API endpoints',
        author: 'user456',
        author_type: 'user',
        score: 0.75,
        scoring_factors: {
          recency: 0.8,
          specificity: 0.7,
          source_authority: 0.6,
          repetition: 0.7,
          emotional_intensity: 0.6,
          strategic_fit: 0.8,
          actionability: 0.9,
          content_quality: 0.7,
        },
        cluster_id: 'cluster-123',
        status: 'clustered',
        provenance: [],
        tags: [],
        created_at: '2026-01-11T00:00:00Z',
        updated_at: '2026-01-11T00:00:00Z',
      },
    ];

    // Setup mock storage
    mockStorage = {
      getClusterByIdAndGreenhouse: vi.fn().mockResolvedValue(mockCluster),
      listSignals: vi.fn().mockResolvedValue(mockSignals),
      updateCluster: vi.fn().mockResolvedValue({ ...mockCluster, summary: 'Updated summary' }),
    } as unknown as CultivateStorage;
  });

  it('should regenerate summary using Anthropic API', async () => {
    // Mock Anthropic response
    const mockAnthropicInstance = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: 'Cluster focusing on API performance degradation and database query optimization issues affecting production systems.',
            },
          ],
        }),
      },
    };

    (Anthropic as any).mockImplementation(() => mockAnthropicInstance);

    const summary = await regenerateSummary(
      'cluster-123',
      'gh-456',
      mockStorage,
      'test-api-key'
    );

    // Verify storage methods called correctly
    expect(mockStorage.getClusterByIdAndGreenhouse).toHaveBeenCalledWith('cluster-123', 'gh-456');
    expect(mockStorage.listSignals).toHaveBeenCalledWith({
      greenhouse_id: 'gh-456',
      cluster_id: 'cluster-123',
      limit: 10,
      offset: 0,
    });

    // Verify Anthropic API called
    expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('API response time degraded'),
        }),
      ]),
    });

    // Verify cluster updated
    expect(mockStorage.updateCluster).toHaveBeenCalledWith('cluster-123', {
      summary: expect.stringContaining('API performance'),
    });

    // Verify summary returned
    expect(summary).toContain('API performance');
  });

  it('should skip regeneration when no API key provided', async () => {
    const summary = await regenerateSummary('cluster-123', 'gh-456', mockStorage);

    // Verify cluster fetched but not updated
    expect(mockStorage.getClusterByIdAndGreenhouse).toHaveBeenCalledWith('cluster-123', 'gh-456');
    expect(mockStorage.listSignals).not.toHaveBeenCalled();
    expect(mockStorage.updateCluster).not.toHaveBeenCalled();

    // Should return existing summary
    expect(summary).toBe('Old summary about API performance issues');
  });

  it('should handle cluster not found', async () => {
    mockStorage.getClusterByIdAndGreenhouse = vi.fn().mockResolvedValue(null);

    await expect(
      regenerateSummary('cluster-999', 'gh-456', mockStorage, 'test-api-key')
    ).rejects.toThrow('Cluster cluster-999 not found in greenhouse gh-456');
  });

  it('should return existing summary when no signals found', async () => {
    mockStorage.listSignals = vi.fn().mockResolvedValue([]);

    const summary = await regenerateSummary(
      'cluster-123',
      'gh-456',
      mockStorage,
      'test-api-key'
    );

    // Should return existing summary without calling API
    expect(summary).toBe('Old summary about API performance issues');
    expect(mockStorage.updateCluster).not.toHaveBeenCalled();
  });

  it('should throw error when Anthropic returns no text content', async () => {
    const mockAnthropicInstance = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', name: 'some_tool' }],
        }),
      },
    };

    (Anthropic as any).mockImplementation(() => mockAnthropicInstance);

    await expect(
      regenerateSummary('cluster-123', 'gh-456', mockStorage, 'test-api-key')
    ).rejects.toThrow('No text response from Haiku');
  });

  it('should include cluster context in prompt', async () => {
    const mockAnthropicInstance = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'New summary' }],
        }),
      },
    };

    (Anthropic as any).mockImplementation(() => mockAnthropicInstance);

    await regenerateSummary('cluster-123', 'gh-456', mockStorage, 'test-api-key');

    const callArgs = mockAnthropicInstance.messages.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    // Verify prompt includes cluster label and current summary
    expect(prompt).toContain('API Performance');
    expect(prompt).toContain('Old summary about API performance issues');
    expect(prompt).toContain('API response time degraded');
    expect(prompt).toContain('Database queries taking too long');
  });
});
