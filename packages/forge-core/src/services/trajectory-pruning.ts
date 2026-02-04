import type { ForgeStorage } from '../storage/interface.js';

// ============================================
// Configuration
// ============================================

/**
 * Configuration options for trajectory pruning.
 */
export interface TrajectoryPruningConfig {
  /**
   * Number of days to retain trajectory events.
   * Events older than this will be deleted.
   * Can be set via FORGE_TRAJECTORY_RETENTION_DAYS env var.
   * Default: 30 days.
   */
  retentionDays?: number;

  /**
   * Alternative: keep events for the last N runs.
   * If set, retentionDays is ignored.
   * Can be set via FORGE_TRAJECTORY_KEEP_RUNS env var.
   */
  keepRuns?: number;
}

/**
 * Default retention period in days.
 */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Default pruning interval in milliseconds (24 hours).
 */
const DEFAULT_PRUNING_INTERVAL_MS = 86400000;

// ============================================
// TrajectoryPruner Service
// ============================================

/**
 * TrajectoryPruner manages cleanup of old trajectory events.
 *
 * Features:
 * - Time-based pruning (delete events older than N days)
 * - Run-based pruning (keep events for last N runs)
 * - Scheduled automatic pruning
 * - Manual pruning trigger
 */
export class TrajectoryPruner {
  private storage: ForgeStorage;
  private config: TrajectoryPruningConfig;
  private pruningIntervalId: NodeJS.Timeout | null = null;

  /**
   * Creates a new TrajectoryPruner instance.
   *
   * @param storage - ForgeStorage instance for database operations
   * @param config - Pruning configuration (can be loaded from env vars)
   */
  constructor(storage: ForgeStorage, config: TrajectoryPruningConfig = {}) {
    this.storage = storage;

    // Load config from environment variables if not explicitly provided
    this.config = {
      retentionDays:
        config.retentionDays ??
        (process.env.FORGE_TRAJECTORY_RETENTION_DAYS
          ? parseInt(process.env.FORGE_TRAJECTORY_RETENTION_DAYS, 10)
          : DEFAULT_RETENTION_DAYS),
      keepRuns:
        config.keepRuns ??
        (process.env.FORGE_TRAJECTORY_KEEP_RUNS
          ? parseInt(process.env.FORGE_TRAJECTORY_KEEP_RUNS, 10)
          : undefined),
    };
  }

  /**
   * Prunes old trajectory events based on configured policy.
   *
   * @returns Number of events deleted
   */
  pruneOldTrajectories(): number {
    if (this.config.keepRuns !== undefined) {
      return this.pruneByRunCount(this.config.keepRuns);
    } else {
      return this.pruneByAge(this.config.retentionDays ?? DEFAULT_RETENTION_DAYS);
    }
  }

  /**
   * Prunes trajectory events older than the specified number of days.
   *
   * @param retentionDays - Number of days to retain events
   * @returns Number of events deleted
   */
  pruneByAge(retentionDays: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Use transaction for atomic operation
    return this.storage.transaction(() => {
      const deletedCount = this.storage.deleteTrajectoryEventsOlderThan(cutoffTimestamp);

      if (deletedCount > 0) {
        console.log(
          `[TrajectoryPruner] Pruned ${deletedCount} events older than ${cutoffTimestamp}`
        );
      }

      return deletedCount;
    });
  }

  /**
   * Prunes trajectory events, keeping only events from the last N runs.
   *
   * @param keepRuns - Number of recent runs to keep events for
   * @returns Number of events deleted
   */
  pruneByRunCount(keepRuns: number): number {
    return this.storage.transaction(() => {
      // Get all runs ordered by creation date (newest first)
      const allRuns = this.storage.listRuns();

      // Sort by created_at descending
      allRuns.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Identify runs to prune (all except the most recent N)
      const runsToPrune = allRuns.slice(keepRuns);

      let deletedCount = 0;

      for (const run of runsToPrune) {
        const deleted = this.storage.deleteTrajectoryEventsByRunId(run.run_id);
        deletedCount += deleted;
      }

      if (deletedCount > 0) {
        console.log(
          `[TrajectoryPruner] Pruned ${deletedCount} events from ${runsToPrune.length} old runs`
        );
      }

      return deletedCount;
    });
  }

  /**
   * Starts scheduled automatic pruning.
   *
   * @param intervalMs - Interval between pruning runs in milliseconds. Default: 24 hours.
   */
  startScheduledPruning(intervalMs: number = DEFAULT_PRUNING_INTERVAL_MS): void {
    // Stop any existing scheduled pruning
    this.stopScheduledPruning();

    console.log(
      `[TrajectoryPruner] Starting scheduled pruning every ${intervalMs / 1000 / 60 / 60} hours`
    );

    // Run immediately on start
    try {
      this.pruneOldTrajectories();
    } catch (err) {
      console.error('[TrajectoryPruner] Error during initial pruning:', err);
    }

    // Schedule periodic pruning
    this.pruningIntervalId = setInterval(() => {
      try {
        const deleted = this.pruneOldTrajectories();
        if (deleted > 0) {
          console.log(`[TrajectoryPruner] Scheduled pruning completed: ${deleted} events pruned`);
        }
      } catch (err) {
        console.error('[TrajectoryPruner] Error during scheduled pruning:', err);
      }
    }, intervalMs);

    // Ensure the interval doesn't prevent Node.js from exiting
    if (this.pruningIntervalId.unref) {
      this.pruningIntervalId.unref();
    }
  }

  /**
   * Stops scheduled automatic pruning.
   */
  stopScheduledPruning(): void {
    if (this.pruningIntervalId) {
      clearInterval(this.pruningIntervalId);
      this.pruningIntervalId = null;
      console.log('[TrajectoryPruner] Scheduled pruning stopped');
    }
  }

  /**
   * Gets the current pruning configuration.
   */
  getConfig(): Readonly<TrajectoryPruningConfig> {
    return { ...this.config };
  }

  /**
   * Updates the pruning configuration.
   * Note: This does not restart scheduled pruning - call startScheduledPruning() again if needed.
   */
  updateConfig(config: Partial<TrajectoryPruningConfig>): void {
    if (config.retentionDays !== undefined) {
      this.config.retentionDays = config.retentionDays;
    }
    if (config.keepRuns !== undefined) {
      this.config.keepRuns = config.keepRuns;
    }
  }

  /**
   * Checks if scheduled pruning is currently active.
   */
  isScheduledPruningActive(): boolean {
    return this.pruningIntervalId !== null;
  }
}

/**
 * Creates a new TrajectoryPruner instance.
 *
 * @param storage - ForgeStorage instance for database operations
 * @param config - Optional pruning configuration
 * @returns A new TrajectoryPruner instance
 */
export function createTrajectoryPruner(
  storage: ForgeStorage,
  config?: TrajectoryPruningConfig
): TrajectoryPruner {
  return new TrajectoryPruner(storage, config);
}
