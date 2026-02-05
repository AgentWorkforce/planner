/**
 * BudgetService - DOT Framework Budget Enforcement
 *
 * Tracks and enforces token/time/cost budgets per task and per run.
 * Research basis: METR 2025 - P(success) ~= (0.5)^(T/50min)
 *
 * Features:
 * - Initialize budget from ExecutionPolicy
 * - Track usage per task
 * - Check budget status with warning levels
 * - Emit trajectory events for observability
 */

import type { ForgeStorage } from '../storage/interface.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import type { ExecutionPolicy, TaskExecutionMetric } from '../domain/types.js';

// ============================================
// Types
// ============================================

/**
 * Usage to record for a task
 */
export interface TaskUsage {
  /** Tokens consumed by the task */
  tokens?: number;
  /** Cost in USD */
  cost?: number;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Model used for the task */
  model_id?: string;
  /** Task outcome */
  outcome?: 'success' | 'failure' | 'timeout' | 'cancelled';
  /** Confidence score from agent */
  confidence?: number;
}

/**
 * Remaining budget information
 */
export interface BudgetRemaining {
  /** Tokens remaining (null if unlimited) */
  tokens: number | null;
  /** Cost remaining in USD (null if unlimited) */
  cost_usd: number | null;
  /** Percentage of token budget used (0-100, null if unlimited) */
  tokens_pct_used: number | null;
  /** Percentage of cost budget used (0-100, null if unlimited) */
  cost_pct_used: number | null;
}

/**
 * Warning level for budget status
 */
export type BudgetWarningLevel = 'none' | 'warning' | 'critical';

/**
 * Result of budget check
 */
export interface BudgetCheckResult {
  /** Whether budget is OK to continue */
  ok: boolean;
  /** Remaining budget information */
  remaining: BudgetRemaining;
  /** Warning level based on usage */
  warning_level: BudgetWarningLevel;
  /** Human-readable message about budget status */
  message?: string;
}

// ============================================
// Constants
// ============================================

/** Warning threshold (80% usage) */
const WARNING_THRESHOLD = 0.8;
/** Critical threshold (95% usage) */
const CRITICAL_THRESHOLD = 0.95;

// ============================================
// BudgetService
// ============================================

/**
 * BudgetService tracks and enforces execution budgets for runs.
 *
 * Budget exhaustion can trigger:
 * - Warning: Log and continue (80% threshold)
 * - Critical: Alert and optionally pause (95% threshold)
 * - Exhausted: Abort or pause run (100%)
 */
export class BudgetService {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture | null;

  /**
   * Creates a new BudgetService.
   *
   * @param storage - ForgeStorage for budget persistence
   * @param trajectoryCapture - Optional TrajectoryCapture for observability events
   */
  constructor(storage: ForgeStorage, trajectoryCapture?: TrajectoryCapture) {
    this.storage = storage;
    this.trajectoryCapture = trajectoryCapture ?? null;
  }

  /**
   * Initializes budget tracking for a run based on ExecutionPolicy.
   *
   * @param runId - Run ID to initialize budget for
   * @param executionPolicy - Policy containing budget limits
   */
  initBudget(runId: string, executionPolicy?: ExecutionPolicy): void {
    const budgets = executionPolicy?.budgets;

    // Extract limits from policy (use null for unlimited)
    const tokensAllowed = budgets?.per_task_token_limit
      ? budgets.per_task_token_limit * 100 // Estimate: allow 100 tasks worth
      : undefined;
    const costAllowedUsd = budgets?.total_cost_limit_usd ?? undefined;

    this.storage.initRunBudget(runId, tokensAllowed, costAllowedUsd);

    // Emit trajectory event
    if (this.trajectoryCapture) {
      this.trajectoryCapture.capture(runId, 'budget_initialized' as any, {
        tokens_allowed: tokensAllowed ?? null,
        cost_allowed_usd: costAllowedUsd ?? null,
      });
    }
  }

  /**
   * Records usage for a completed task and updates run budget.
   *
   * @param runId - Run the task belongs to
   * @param taskId - Task that consumed resources
   * @param usage - Usage metrics to record
   * @returns The created metric record
   */
  recordUsage(runId: string, taskId: string, usage: TaskUsage): TaskExecutionMetric {
    // Create metric record
    const metric: TaskExecutionMetric = {
      metric_id: crypto.randomUUID(),
      task_id: taskId,
      run_id: runId,
      model_id: usage.model_id,
      complexity_score: undefined, // Set by caller if known
      duration_ms: usage.duration_ms,
      tokens_used: usage.tokens,
      cost_usd: usage.cost,
      outcome: usage.outcome,
      confidence: usage.confidence,
      created_at: new Date().toISOString(),
    };

    // Save metric
    this.storage.saveTaskMetric(metric);

    // Update run budget
    if (usage.tokens !== undefined || usage.cost !== undefined) {
      this.storage.updateRunBudget(
        runId,
        usage.tokens ?? 0,
        usage.cost ?? 0
      );
    }

    // Emit trajectory event
    if (this.trajectoryCapture) {
      this.trajectoryCapture.capture(
        runId,
        'budget_updated' as any,
        {
          task_id: taskId,
          tokens_used: usage.tokens ?? 0,
          cost_usd: usage.cost ?? 0,
          duration_ms: usage.duration_ms ?? null,
        },
        taskId
      );
    }

    return metric;
  }

  /**
   * Checks current budget status for a run.
   *
   * @param runId - Run to check budget for
   * @returns Budget check result with ok status, remaining, and warning level
   */
  checkBudget(runId: string): BudgetCheckResult {
    const budget = this.storage.getRunBudget(runId);

    // If no budget record, assume OK (no limits set)
    if (!budget) {
      return {
        ok: true,
        remaining: {
          tokens: null,
          cost_usd: null,
          tokens_pct_used: null,
          cost_pct_used: null,
        },
        warning_level: 'none',
      };
    }

    // Calculate remaining
    const tokensRemaining = budget.tokens_allowed !== null
      ? Math.max(0, budget.tokens_allowed - budget.tokens_used)
      : null;
    const costRemaining = budget.cost_allowed_usd !== null
      ? Math.max(0, budget.cost_allowed_usd - budget.cost_used_usd)
      : null;

    // Calculate percentages
    const tokensPctUsed = budget.tokens_allowed !== null && budget.tokens_allowed > 0
      ? (budget.tokens_used / budget.tokens_allowed) * 100
      : null;
    const costPctUsed = budget.cost_allowed_usd !== null && budget.cost_allowed_usd > 0
      ? (budget.cost_used_usd / budget.cost_allowed_usd) * 100
      : null;

    const remaining: BudgetRemaining = {
      tokens: tokensRemaining,
      cost_usd: costRemaining,
      tokens_pct_used: tokensPctUsed,
      cost_pct_used: costPctUsed,
    };

    // Determine warning level based on highest usage
    const maxPctUsed = Math.max(
      (tokensPctUsed ?? 0) / 100,
      (costPctUsed ?? 0) / 100
    );

    let warningLevel: BudgetWarningLevel = 'none';
    let ok = true;
    let message: string | undefined;

    if (maxPctUsed >= 1.0) {
      // Budget exhausted
      ok = false;
      warningLevel = 'critical';
      message = 'Budget exhausted - run should be paused or aborted';
    } else if (maxPctUsed >= CRITICAL_THRESHOLD) {
      warningLevel = 'critical';
      message = `Budget critical (${(maxPctUsed * 100).toFixed(1)}% used) - approaching limit`;
    } else if (maxPctUsed >= WARNING_THRESHOLD) {
      warningLevel = 'warning';
      message = `Budget warning (${(maxPctUsed * 100).toFixed(1)}% used) - monitor closely`;
    }

    // Emit warning/critical events
    if (warningLevel !== 'none' && this.trajectoryCapture) {
      this.trajectoryCapture.capture(runId, 'budget_warning' as any, {
        warning_level: warningLevel,
        tokens_pct_used: tokensPctUsed,
        cost_pct_used: costPctUsed,
        message,
      });
    }

    return {
      ok,
      remaining,
      warning_level: warningLevel,
      message,
    };
  }

  /**
   * Gets all metrics for a run.
   *
   * @param runId - Run to get metrics for
   * @returns Array of task execution metrics
   */
  getRunMetrics(runId: string): TaskExecutionMetric[] {
    return this.storage.getTaskMetrics(runId);
  }

  /**
   * Gets metrics for a specific model (for Tuner analysis).
   *
   * @param modelId - Model ID to filter by
   * @returns Array of task execution metrics for the model
   */
  getModelMetrics(modelId: string): TaskExecutionMetric[] {
    return this.storage.getTaskMetricsByModel(modelId);
  }
}

/**
 * Factory function to create BudgetService.
 */
export function createBudgetService(
  storage: ForgeStorage,
  trajectoryCapture?: TrajectoryCapture
): BudgetService {
  return new BudgetService(storage, trajectoryCapture);
}
