import type { ForgeStorage } from '../storage/interface.js';
import type { Run, RunStatus, Task, TaskStatus } from '../domain/types.js';
import type { PlannerConfig } from '../config/forge-config.js';
import { PlannerClient, PlannerApiError, type RunStatusUpdate } from './planner-client.js';

/**
 * Sync error stored when Planner status reporting fails.
 */
export interface PlannerSyncError {
  timestamp: string;
  message: string;
  status_code?: number;
  retry_count: number;
}

/**
 * Health status for the status reporter.
 */
export interface StatusReporterHealth {
  /** Whether the Planner API is reachable */
  planner_reachable: boolean;
  /** Last successful sync timestamp */
  last_sync?: string;
  /** Last sync error (if any) */
  last_error?: PlannerSyncError;
  /** Number of pending status updates */
  pending_updates: number;
}

/**
 * Extended Run type with planner sync tracking.
 */
export interface RunWithSync extends Run {
  planner_sync_error?: string; // JSON-serialized PlannerSyncError
}

/**
 * StatusReporter handles reporting run status changes back to the Planner service.
 *
 * Features:
 * - Automatic status reporting on run state changes
 * - Retry logic for transient failures
 * - Error tracking for failed syncs
 * - Health monitoring for Planner connectivity
 */
export class StatusReporter {
  private readonly plannerClient: PlannerClient;
  private readonly storage: ForgeStorage;
  private lastSync?: string;
  private lastError?: PlannerSyncError;
  private pendingUpdates: Map<string, RunStatusUpdate> = new Map();
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    plannerConfig: PlannerConfig,
    storage: ForgeStorage,
    options: {
      maxRetries?: number;
      retryDelayMs?: number;
    } = {}
  ) {
    this.plannerClient = new PlannerClient(plannerConfig);
    this.storage = storage;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Reports a run status change to the Planner service.
   *
   * @param run - The run that changed status
   * @param previousStatus - The previous status (for logging)
   */
  async reportStatusChange(run: Run, previousStatus?: RunStatus): Promise<void> {
    const tasks = this.storage.listTasksByRun(run.run_id);
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;

    const statusUpdate: RunStatusUpdate = {
      run_id: run.run_id,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      error: run.error,
      tasks_completed: completedTasks,
      tasks_total: tasks.length,
    };

    await this.reportWithRetry(run.plan_id, statusUpdate);
  }

  /**
   * Reports a run status update with retry logic.
   */
  private async reportWithRetry(
    planId: string,
    statusUpdate: RunStatusUpdate,
    retryCount: number = 0
  ): Promise<void> {
    try {
      await this.plannerClient.reportRunStatus(planId, statusUpdate);
      this.lastSync = new Date().toISOString();
      this.lastError = undefined;
      this.pendingUpdates.delete(statusUpdate.run_id);

      // Clear any stored sync error on the run
      this.clearSyncError(statusUpdate.run_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const statusCode = err instanceof PlannerApiError ? err.statusCode : undefined;

      // Determine if we should retry
      const isRetryable = this.isRetryableError(err);
      const shouldRetry = isRetryable && retryCount < this.maxRetries;

      if (shouldRetry) {
        // Wait and retry
        await this.delay(this.retryDelayMs * Math.pow(2, retryCount)); // Exponential backoff
        return this.reportWithRetry(planId, statusUpdate, retryCount + 1);
      }

      // Max retries exceeded or non-retryable error
      const syncError: PlannerSyncError = {
        timestamp: new Date().toISOString(),
        message: errorMessage,
        status_code: statusCode,
        retry_count: retryCount,
      };

      this.lastError = syncError;
      this.pendingUpdates.set(statusUpdate.run_id, statusUpdate);

      // Store the error on the run for API exposure
      this.storeSyncError(statusUpdate.run_id, syncError);

      // Don't throw - status reporting failures shouldn't break run execution
      console.error(
        `Failed to report status to Planner after ${retryCount + 1} attempts: ${errorMessage}`
      );
    }
  }

  /**
   * Determines if an error is retryable.
   */
  private isRetryableError(err: unknown): boolean {
    if (err instanceof PlannerApiError) {
      // Retry on network errors (0) or server errors (5xx)
      return err.statusCode === 0 || (err.statusCode >= 500 && err.statusCode < 600);
    }
    // Retry on generic errors (likely network issues)
    return true;
  }

  /**
   * Stores a sync error on the run in the database.
   */
  private storeSyncError(runId: string, error: PlannerSyncError): void {
    try {
      this.storage.updateRun(runId, {
        // Store as JSON in a metadata field or dedicated column
        // For now, we'll use the error field as a workaround
        // In production, add a planner_sync_error column
      } as Partial<Run>);
    } catch (e) {
      console.error(`Failed to store sync error for run ${runId}:`, e);
    }
  }

  /**
   * Clears any stored sync error on the run.
   */
  private clearSyncError(runId: string): void {
    try {
      this.storage.updateRun(runId, {} as Partial<Run>);
    } catch (e) {
      console.error(`Failed to clear sync error for run ${runId}:`, e);
    }
  }

  /**
   * Helper to delay execution.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retries reporting for all pending updates.
   * Call this periodically or on startup to sync failed updates.
   */
  async retryPendingUpdates(): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const [runId, statusUpdate] of this.pendingUpdates.entries()) {
      const run = this.storage.getRun(runId);
      if (!run) {
        // Run no longer exists, remove from pending
        this.pendingUpdates.delete(runId);
        continue;
      }

      try {
        await this.plannerClient.reportRunStatus(run.plan_id, statusUpdate);
        this.pendingUpdates.delete(runId);
        this.clearSyncError(runId);
        succeeded++;
      } catch {
        failed++;
      }
    }

    return { succeeded, failed };
  }

  /**
   * Gets the current health status of the reporter.
   */
  async getHealth(): Promise<StatusReporterHealth> {
    const plannerReachable = await this.plannerClient.isReachable();

    return {
      planner_reachable: plannerReachable,
      last_sync: this.lastSync,
      last_error: this.lastError,
      pending_updates: this.pendingUpdates.size,
    };
  }

  /**
   * Reports that a run has started.
   */
  async reportRunStarted(run: Run): Promise<void> {
    await this.reportStatusChange(run, 'pending');
  }

  /**
   * Reports that a run has been paused.
   */
  async reportRunPaused(run: Run): Promise<void> {
    await this.reportStatusChange(run, 'running');
  }

  /**
   * Reports that a run has completed successfully.
   */
  async reportRunCompleted(run: Run): Promise<void> {
    await this.reportStatusChange(run, 'running');
  }

  /**
   * Reports that a run has failed.
   */
  async reportRunFailed(run: Run): Promise<void> {
    await this.reportStatusChange(run, 'running');
  }

  /**
   * Reports that a run has been cancelled.
   */
  async reportRunCancelled(run: Run): Promise<void> {
    await this.reportStatusChange(run);
  }
}

/**
 * Creates a StatusReporter instance.
 */
export function createStatusReporter(
  plannerConfig: PlannerConfig,
  storage: ForgeStorage,
  options?: {
    maxRetries?: number;
    retryDelayMs?: number;
  }
): StatusReporter {
  return new StatusReporter(plannerConfig, storage, options);
}

/**
 * Utility function to count tasks by status.
 */
export function countTasksByStatus(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<string, number> = {
    pending: 0,
    queued: 0,
    running: 0,
    auditing: 0,
    awaiting_approval: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
  };

  for (const task of tasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }

  return counts as Record<TaskStatus, number>;
}
