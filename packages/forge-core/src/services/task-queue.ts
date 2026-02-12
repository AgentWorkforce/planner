/**
 * TaskQueue - DOT Framework Parallelism Control
 *
 * Manages task scheduling with configurable concurrency limits.
 * Prevents resource contention and cascading failures through controlled parallelism.
 *
 * Features:
 * - Global max concurrent tasks limit
 * - Per-scope concurrency limits
 * - Sequential execution preference within scopes
 * - Ready task selection respecting all constraints
 */

import type { ParallelismConfig, Task } from '../domain/types.js';
import { DEFAULT_EXECUTION_POLICY } from '../domain/types.js';

// ============================================
// Types
// ============================================

/**
 * Task with scope information for queue management
 */
export interface QueuedTask {
  /** Task ID */
  task_id: string;
  /** Step ID for ordering within scope */
  step_id: string;
  /** Scope for per-scope limits (optional) */
  scope?: string;
  /** Creation timestamp for stable ordering (plan step order) */
  created_at?: string;
}

/**
 * Statistics about current queue state
 */
export interface QueueStats {
  /** Total ready tasks waiting */
  total_ready: number;
  /** Currently running tasks */
  running: number;
  /** Available slots */
  available_slots: number;
  /** Per-scope breakdown */
  by_scope: Record<string, { ready: number; running: number }>;
}

// ============================================
// TaskQueue
// ============================================

/**
 * TaskQueue manages parallelism for task execution.
 *
 * Enforces limits:
 * - max_concurrent_tasks: Global limit across all scopes (default: 5)
 * - max_concurrent_per_scope: Optional per-scope limit
 * - prefer_sequential_in_scope: Order tasks by step_id within scope
 */
export class TaskQueue {
  private config: ParallelismConfig;

  /**
   * Creates a new TaskQueue.
   *
   * @param config - Parallelism configuration
   */
  constructor(config?: Partial<ParallelismConfig>) {
    // Merge with defaults
    const defaults = DEFAULT_EXECUTION_POLICY.parallelism;
    this.config = {
      max_concurrent_tasks: config?.max_concurrent_tasks ?? defaults.max_concurrent_tasks,
      max_concurrent_per_scope: config?.max_concurrent_per_scope ?? defaults.max_concurrent_per_scope,
      prefer_sequential_in_scope: config?.prefer_sequential_in_scope ?? defaults.prefer_sequential_in_scope,
    };
  }

  /**
   * Gets the next batch of ready tasks to execute, respecting parallelism limits.
   *
   * Strategy:
   * 1. Group ready tasks by scope
   * 2. Apply per-scope limit to each group (default 2 per scope)
   * 3. Apply global limit across all selected tasks
   * 4. This prevents any single scope from monopolizing all agent slots
   *
   * @param allReadyTasks - All tasks that are ready to execute (dependencies met)
   * @param currentlyRunning - Tasks currently being executed
   * @returns Subset of ready tasks that can be started
   */
  getNextReadyTasks(
    allReadyTasks: QueuedTask[],
    currentlyRunning: QueuedTask[]
  ): QueuedTask[] {
    const runningCount = currentlyRunning.length;
    const globalLimit = this.config.max_concurrent_tasks;
    const perScopeLimit = this.config.max_concurrent_per_scope ?? 2; // Default: 2 per scope

    // Calculate available global slots
    const availableGlobalSlots = Math.max(0, globalLimit - runningCount);
    if (availableGlobalSlots === 0) {
      return [];
    }

    // Sort ready tasks if sequential preference is set
    let sortedReady = [...allReadyTasks];
    if (this.config.prefer_sequential_in_scope) {
      sortedReady = this.sortByScope(sortedReady);
    }

    // Build running counts by scope
    const runningByScope = this.countByScope(currentlyRunning);

    // Group ready tasks by scope
    const tasksByScope = new Map<string, QueuedTask[]>();
    for (const task of sortedReady) {
      const scopeKey = task.scope ?? 'default';
      if (!tasksByScope.has(scopeKey)) {
        tasksByScope.set(scopeKey, []);
      }
      tasksByScope.get(scopeKey)!.push(task);
    }

    // Select tasks respecting both per-scope and global limits
    const selected: QueuedTask[] = [];

    // Iterate through scopes and select up to per-scope limit from each
    for (const [scopeKey, scopeTasks] of tasksByScope.entries()) {
      const scope = scopeKey === 'default' ? undefined : scopeKey;
      const scopeRunning = runningByScope[scopeKey] ?? 0;

      // Calculate how many more tasks this scope can run
      const scopeAvailable = perScopeLimit - scopeRunning;
      if (scopeAvailable <= 0) {
        continue; // Scope is at capacity
      }

      // Select up to scopeAvailable tasks from this scope
      let selectedFromScope = 0;
      for (const task of scopeTasks) {
        // Check sequential preference - if enabled, only allow first task per scope
        if (this.config.prefer_sequential_in_scope && scope) {
          if (scopeRunning > 0 || selectedFromScope > 0) {
            // Already have a task for this scope, skip remaining
            break;
          }
        }

        // Check if we've hit the per-scope limit for this iteration
        if (selectedFromScope >= scopeAvailable) {
          break;
        }

        // Check global limit
        if (selected.length >= availableGlobalSlots) {
          break;
        }

        selected.push(task);
        selectedFromScope++;
      }

      // If we've filled all global slots, stop processing scopes
      if (selected.length >= availableGlobalSlots) {
        break;
      }
    }

    return selected;
  }

  /**
   * Convenience method to work with Task objects directly.
   *
   * @param readyTasks - Ready Task objects
   * @param runningTasks - Currently running Task objects
   * @returns Task IDs that can be started
   */
  selectNextTasks(readyTasks: Task[], runningTasks: Task[]): string[] {
    const readyQueued = readyTasks.map(t => this.taskToQueued(t));
    const runningQueued = runningTasks.map(t => this.taskToQueued(t));

    const selected = this.getNextReadyTasks(readyQueued, runningQueued);
    return selected.map(t => t.task_id);
  }

  /**
   * Gets current queue statistics.
   *
   * @param readyTasks - All ready tasks
   * @param runningTasks - Currently running tasks
   * @returns Queue statistics
   */
  getStats(readyTasks: QueuedTask[], runningTasks: QueuedTask[]): QueueStats {
    const readyByScope = this.countByScope(readyTasks);
    const runningByScope = this.countByScope(runningTasks);

    // Merge scopes from both ready and running
    const allScopes = new Set([
      ...Object.keys(readyByScope),
      ...Object.keys(runningByScope),
    ]);

    const byScope: Record<string, { ready: number; running: number }> = {};
    for (const scope of allScopes) {
      byScope[scope] = {
        ready: readyByScope[scope] ?? 0,
        running: runningByScope[scope] ?? 0,
      };
    }

    return {
      total_ready: readyTasks.length,
      running: runningTasks.length,
      available_slots: Math.max(0, this.config.max_concurrent_tasks - runningTasks.length),
      by_scope: byScope,
    };
  }

  /**
   * Updates the parallelism configuration.
   * Useful when Tuner adjusts limits dynamically.
   *
   * @param newConfig - New configuration values
   */
  updateConfig(newConfig: Partial<ParallelismConfig>): void {
    if (newConfig.max_concurrent_tasks !== undefined) {
      this.config.max_concurrent_tasks = newConfig.max_concurrent_tasks;
    }
    if (newConfig.max_concurrent_per_scope !== undefined) {
      this.config.max_concurrent_per_scope = newConfig.max_concurrent_per_scope;
    }
    if (newConfig.prefer_sequential_in_scope !== undefined) {
      this.config.prefer_sequential_in_scope = newConfig.prefer_sequential_in_scope;
    }
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): ParallelismConfig {
    return { ...this.config };
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Sorts tasks by scope, then by creation order within scope.
   * created_at reflects plan step order (tasks are inserted in step_order).
   * Falls back to step_id alphabetical if created_at is missing.
   */
  private sortByScope(tasks: QueuedTask[]): QueuedTask[] {
    return [...tasks].sort((a, b) => {
      // First sort by scope (undefined scope goes last)
      const scopeA = a.scope ?? '\uffff';
      const scopeB = b.scope ?? '\uffff';
      if (scopeA !== scopeB) {
        return scopeA.localeCompare(scopeB);
      }
      // Then sort by creation order within scope (plan step order)
      if (a.created_at && b.created_at) {
        return a.created_at.localeCompare(b.created_at);
      }
      // Fallback to step_id if created_at not available
      return a.step_id.localeCompare(b.step_id);
    });
  }

  /**
   * Counts tasks by scope.
   */
  private countByScope(tasks: QueuedTask[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const scope = task.scope ?? '_no_scope';
      counts[scope] = (counts[scope] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * Converts a Task to QueuedTask.
   */
  private taskToQueued(task: Task): QueuedTask {
    return {
      task_id: task.task_id,
      step_id: task.step_id,
      scope: task.scope,
      created_at: task.created_at,
    };
  }
}

/**
 * Factory function to create TaskQueue.
 */
export function createTaskQueue(config?: Partial<ParallelismConfig>): TaskQueue {
  return new TaskQueue(config);
}
