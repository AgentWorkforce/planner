/**
 * Tests for TrendDetector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrendDetector } from './trends.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { Cluster, Signal } from '../domain/types.js';
import type { SSEBroadcaster } from '../sse/broadcaster.js';

// Mock storage
const createMockStorage = (clusters: Cluster[], signals: Signal[]): CultivateStorage => {
  const updates: Array<{ id: string; data: any }> = [];

  return {
    listClustersByGreenhouse: vi.fn(async () => clusters),
    listSignals: vi.fn(async (filters) => {
      return signals.filter(s => s.cluster_id === filters.cluster_id);
    }),
    updateCluster: vi.fn(async (id, input) => {
      updates.push({ id, data: input });
      const cluster = clusters.find(c => c.id === id);
      if (!cluster) throw new Error('Cluster not found');
      return {
        ...cluster,
        ...input,
      };
    }),
    _updates: updates,
  } as any;
};

// Mock SSE broadcaster
const createMockBroadcaster = (): SSEBroadcaster => {
  const events: any[] = [];

  return {
    emitClusterTrending: vi.fn((payload) => {
      events.push(payload);
    }),
    _events: events,
  } as any;
};

describe('TrendDetector', () => {
  it('should calculate velocity correctly', async () => {
    const now = new Date();
    const clusters: Cluster[] = [
      {
        id: 'cluster-1',
        greenhouse_id: 'gh-1',
        label: 'Test Cluster',
        summary: 'Test',
        signal_count: 10,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    const signals: Signal[] = [
      // 3 signals in last 7 days
      {
        id: 'sig-1',
        cluster_id: 'cluster-1',
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
      {
        id: 'sig-2',
        cluster_id: 'cluster-1',
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
      {
        id: 'sig-3',
        cluster_id: 'cluster-1',
        created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
      // 2 additional signals in last 30 days (but not in last 7)
      {
        id: 'sig-4',
        cluster_id: 'cluster-1',
        created_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
      {
        id: 'sig-5',
        cluster_id: 'cluster-1',
        created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
    ];

    const mockStorage = createMockStorage(clusters, signals);
    const detector = new TrendDetector(mockStorage);

    await detector.detectTrends('gh-1');

    const updates = (mockStorage as any)._updates;
    expect(updates).toHaveLength(1);

    const update = updates[0];
    expect(update.data.velocity_weekly).toBe(3);
    expect(update.data.velocity_monthly).toBe(5);
  });

  it('should classify trends correctly', async () => {
    const now = new Date();

    // Test rising trend: weighted > 2
    const clusters1: Cluster[] = [
      {
        id: 'cluster-1',
        greenhouse_id: 'gh-1',
        label: 'Rising',
        summary: 'Test',
        signal_count: 10,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    // 4 weekly signals
    const signals1: Signal[] = Array.from({ length: 4 }, (_, i) => ({
      id: `sig-${i}`,
      cluster_id: 'cluster-1',
      created_at: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
    } as Signal));

    const mockStorage1 = createMockStorage(clusters1, signals1);
    const detector1 = new TrendDetector(mockStorage1);

    await detector1.detectTrends('gh-1');

    const updates1 = (mockStorage1 as any)._updates;
    // weighted = 0.7 * 4 + 0.3 * (4 / 4) = 2.8 + 0.3 = 3.1 > 2 → rising
    expect(updates1[0].data.trend).toBe('rising');

    // Test declining trend: weighted < 0.5
    const clusters2: Cluster[] = [
      {
        id: 'cluster-2',
        greenhouse_id: 'gh-2',
        label: 'Declining',
        summary: 'Test',
        signal_count: 10,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    // 0 weekly signals, 1 monthly signal
    const signals2: Signal[] = [
      {
        id: 'sig-1',
        cluster_id: 'cluster-2',
        created_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
    ];

    const mockStorage2 = createMockStorage(clusters2, signals2);
    const detector2 = new TrendDetector(mockStorage2);

    await detector2.detectTrends('gh-2');

    const updates2 = (mockStorage2 as any)._updates;
    // weighted = 0.7 * 0 + 0.3 * (1 / 4) = 0 + 0.075 = 0.075 < 0.5 → declining
    expect(updates2[0].data.trend).toBe('declining');
  });

  it('should emit SSE event when transitioning to rising', async () => {
    const now = new Date();
    const clusters: Cluster[] = [
      {
        id: 'cluster-1',
        greenhouse_id: 'gh-1',
        label: 'Test Cluster',
        summary: 'Test',
        signal_count: 10,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    // 4 weekly signals → rising
    const signals: Signal[] = Array.from({ length: 4 }, (_, i) => ({
      id: `sig-${i}`,
      cluster_id: 'cluster-1',
      created_at: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
    } as Signal));

    const mockStorage = createMockStorage(clusters, signals);
    const mockBroadcaster = createMockBroadcaster();
    const detector = new TrendDetector(mockStorage, mockBroadcaster);

    await detector.detectTrends('gh-1');

    const events = (mockBroadcaster as any)._events;
    expect(events).toHaveLength(1);
    expect(events[0].cluster_id).toBe('cluster-1');
    expect(events[0].trend).toBe('rising');
    expect(events[0].velocity_weekly).toBe(4);
  });

  it('should not emit SSE when cluster already rising', async () => {
    const now = new Date();
    const clusters: Cluster[] = [
      {
        id: 'cluster-1',
        greenhouse_id: 'gh-1',
        label: 'Test Cluster',
        summary: 'Test',
        signal_count: 10,
        trend: 'rising' as const, // Already rising
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    // 4 weekly signals → rising
    const signals: Signal[] = Array.from({ length: 4 }, (_, i) => ({
      id: `sig-${i}`,
      cluster_id: 'cluster-1',
      created_at: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
    } as Signal));

    const mockStorage = createMockStorage(clusters, signals);
    const mockBroadcaster = createMockBroadcaster();
    const detector = new TrendDetector(mockStorage, mockBroadcaster);

    await detector.detectTrends('gh-1');

    const events = (mockBroadcaster as any)._events;
    expect(events).toHaveLength(0); // No event emitted
  });

  it('should return correct counts', async () => {
    const now = new Date();
    const clusters: Cluster[] = [
      // Rising cluster
      {
        id: 'cluster-1',
        greenhouse_id: 'gh-1',
        label: 'Rising',
        summary: 'Test',
        signal_count: 10,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      // Stable cluster
      {
        id: 'cluster-2',
        greenhouse_id: 'gh-1',
        label: 'Stable',
        summary: 'Test',
        signal_count: 5,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      // Declining cluster
      {
        id: 'cluster-3',
        greenhouse_id: 'gh-1',
        label: 'Declining',
        summary: 'Test',
        signal_count: 3,
        trend: 'stable' as const,
        velocity_weekly: 0,
        velocity_monthly: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    const signals: Signal[] = [
      // cluster-1: 4 weekly → rising
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `sig-1-${i}`,
        cluster_id: 'cluster-1',
        created_at: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal)),
      // cluster-2: 1 weekly → stable
      {
        id: 'sig-2-1',
        cluster_id: 'cluster-2',
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      } as Signal,
      // cluster-3: 0 weekly → declining
    ];

    const mockStorage = createMockStorage(clusters, signals);
    const detector = new TrendDetector(mockStorage);

    const result = await detector.detectTrends('gh-1');

    expect(result.updated).toBe(3);
    expect(result.rising).toBe(1);
    expect(result.stable).toBe(1);
    expect(result.declining).toBe(1);
  });
});
