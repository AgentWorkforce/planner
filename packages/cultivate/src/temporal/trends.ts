/**
 * Trend Detector - Detect cluster growth/decline trends
 */

import type { CultivateStorage } from '../storage/interface.js';
import type { ClusterTrend } from '../domain/types.js';
import type { SSEBroadcaster } from '../sse/broadcaster.js';

export class TrendDetector {
  constructor(
    private storage: CultivateStorage,
    private broadcaster?: SSEBroadcaster
  ) {}

  /**
   * Detect trends for all clusters in a greenhouse.
   *
   * Velocity calculation:
   * - weekly: signals added in last 7 days
   * - monthly: signals added in last 30 days
   * - weighted: 0.7 * weekly + 0.3 * (monthly / 4)
   *
   * Classification:
   * - rising: weighted > 2 (more than 2 signals/week equivalent)
   * - declining: weighted < 0.5
   * - stable: otherwise
   *
   * Emits cluster:trending SSE event when a cluster transitions TO rising.
   */
  async detectTrends(greenhouseId: string): Promise<{
    updated: number;
    rising: number;
    declining: number;
    stable: number;
  }> {
    // Load all clusters for the greenhouse
    const clusters = await this.storage.listClustersByGreenhouse(greenhouseId);

    let updatedCount = 0;
    let risingCount = 0;
    let decliningCount = 0;
    let stableCount = 0;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const cluster of clusters) {
      // Query signal counts for this cluster in last 7 and 30 days
      const allSignals = await this.storage.listSignals({
        greenhouse_id: greenhouseId,
        cluster_id: cluster.id,
        limit: 10000,
        offset: 0,
      });

      const weeklySignals = allSignals.filter(s => {
        const createdAt = new Date(s.created_at);
        return createdAt >= oneWeekAgo;
      });

      const monthlySignals = allSignals.filter(s => {
        const createdAt = new Date(s.created_at);
        return createdAt >= oneMonthAgo;
      });

      const velocityWeekly = weeklySignals.length;
      const velocityMonthly = monthlySignals.length;

      // Calculate weighted velocity: 0.7 * weekly + 0.3 * (monthly / 4)
      const weightedVelocity = 0.7 * velocityWeekly + 0.3 * (velocityMonthly / 4);

      // Classify trend
      let newTrend: ClusterTrend;
      if (weightedVelocity > 2) {
        newTrend = 'rising';
        risingCount++;
      } else if (weightedVelocity < 0.5) {
        newTrend = 'declining';
        decliningCount++;
      } else {
        newTrend = 'stable';
        stableCount++;
      }

      // Check if trend changed to rising (for SSE emission)
      const previousTrend = cluster.trend;
      const transitionedToRising = previousTrend !== 'rising' && newTrend === 'rising';

      // Update cluster with new velocities and trend
      await this.storage.updateCluster(cluster.id, {
        velocity_weekly: velocityWeekly,
        velocity_monthly: velocityMonthly,
        trend: newTrend,
      });

      updatedCount++;

      // Emit cluster:trending SSE event if transitioned to rising
      if (transitionedToRising && this.broadcaster) {
        this.broadcaster.emitClusterTrending({
          cluster_id: cluster.id,
          greenhouse_id: greenhouseId,
          label: cluster.label,
          trend: newTrend,
          velocity_weekly: velocityWeekly,
        });
      }
    }

    console.log(
      `[TrendDetector] Greenhouse ${greenhouseId}: updated ${updatedCount} clusters ` +
      `(${risingCount} rising, ${stableCount} stable, ${decliningCount} declining)`
    );

    return {
      updated: updatedCount,
      rising: risingCount,
      declining: decliningCount,
      stable: stableCount,
    };
  }
}
