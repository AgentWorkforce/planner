/**
 * TestExecutor - Simulates task execution without spawning real agents.
 *
 * Walks the task DAG, marks tasks as running/completed, records metrics,
 * and pushes outcomes to the tuner for learning.
 *
 * Used by testbench to drive scenarios through the forge pipeline.
 */

import type { ForgeStorage } from '../storage/interface.js';
import {
  TaskStatus,
  RunStatus,
  AttemptOutcome,
  createTaskExecutionMetric,
} from '../domain/types.js';

export interface TestExecutorConfig {
  /** Base URL for the tuner service. If empty, tuner integration is skipped. */
  tunerUrl?: string;
  /** Min delay per task in ms (default: 100) */
  minDelayMs?: number;
  /** Max delay per task in ms (default: 300) */
  maxDelayMs?: number;
  /** Model ID for synthetic metrics (default: 'claude-sonnet') */
  modelId?: string;
  /** Complexity estimate for synthetic metrics (default: 'simple') */
  complexityEstimate?: string;
  /** Outcome source tag (default: 'test') */
  source?: string;
}

interface ResolvedConfig {
  tunerUrl: string;
  minDelayMs: number;
  maxDelayMs: number;
  modelId: string;
  complexityEstimate: string;
  source: string;
}

/**
 * Task outcome shape for tuner POST /api/tuner/outcomes/task
 */
interface TunerTaskOutcome {
  run_id: string;
  task_id: string;
  step_id: string;
  model_used: string;
  complexity_estimate: string;
  outcome: 'success' | 'failure' | 'timeout' | 'cancelled';
  attempts: number;
  duration_seconds: number;
  tokens_used: number;
  cost_usd: number;
  timestamp: string;
  source: string;
}

/**
 * Run outcome shape for tuner POST /api/tuner/outcomes/run
 */
interface TunerRunOutcome {
  run_id: string;
  plan_id: string;
  outcome: 'completed' | 'failed' | 'cancelled';
  tasks_total: number;
  tasks_succeeded: number;
  tasks_failed: number;
  total_duration_seconds: number;
  total_tokens: number;
  total_cost_usd: number;
  replan_count: number;
  escalation_count: number;
  timestamp: string;
  source: string;
}

export class TestExecutor {
  private storage: ForgeStorage;
  private config: ResolvedConfig;

  constructor(storage: ForgeStorage, config: TestExecutorConfig = {}) {
    this.storage = storage;
    this.config = {
      tunerUrl: config.tunerUrl || '',
      minDelayMs: config.minDelayMs ?? 100,
      maxDelayMs: config.maxDelayMs ?? 300,
      modelId: config.modelId || 'claude-sonnet',
      complexityEstimate: config.complexityEstimate || 'simple',
      source: config.source || 'test',
    };
  }

  /**
   * Schedule ready tasks for execution.
   * Called after run creation or gate approval.
   * Runs asynchronously — does not block the caller.
   */
  async scheduleReadyTasks(runId: string): Promise<void> {
    this.executeTaskLoop(runId).catch((err) => {
      console.error(`[TestExecutor] Error executing tasks for run ${runId}:`, err);
    });
  }

  private async executeTaskLoop(runId: string): Promise<void> {
    const startTime = Date.now();
    const taskMetrics = new Map<string, { durationMs: number; tokens: number; cost: number }>();
    let staleCount = 0;
    const maxStale = 50; // Prevent infinite loops on blocked tasks

    while (true) {
      const readyTasks = this.storage.getReadyTasks(runId);

      if (readyTasks.length === 0) {
        const allTasks = this.storage.listTasksByRun(runId);
        const pendingTasks = allTasks.filter(
          (t) => t.status === TaskStatus.Pending || t.status === TaskStatus.Queued
        );

        if (pendingTasks.length === 0) {
          await this.finalizeRun(runId, startTime, taskMetrics);
          return;
        }

        staleCount++;
        if (staleCount > maxStale) {
          console.warn(
            `[TestExecutor] Run ${runId} stalled with ${pendingTasks.length} pending tasks — aborting.`,
            pendingTasks.map((t) => ({ step_id: t.step_id, deps: t.dependencies }))
          );
          this.storage.updateRunStatus(runId, RunStatus.Failed);
          return;
        }

        await this.delay(this.config.minDelayMs);
        continue;
      }

      staleCount = 0; // Reset on progress

      for (const task of readyTasks) {
        const taskStartTime = Date.now();

        // pending → running
        this.storage.updateTaskStatus(task.task_id, TaskStatus.Running);

        // Simulate work
        await this.delay(this.randomDelay());

        // running → completed
        this.storage.updateTaskStatus(task.task_id, TaskStatus.Completed);

        const durationMs = Date.now() - taskStartTime;
        // TODO: Parse real token usage from test agent output
        // Test executor doesn't spawn real agents, so metrics are unavailable
        const tokensUsed = 0; // Real token data not available in test mode
        const costUsd = 0; // Real cost data not available in test mode

        // Record execution metric
        const metric = createTaskExecutionMetric({
          taskId: task.task_id,
          runId: task.run_id,
          modelId: this.config.modelId,
          durationMs,
          tokensUsed,
          costUsd,
          outcome: AttemptOutcome.Success,
          confidence: 0.95,
        });
        this.storage.saveTaskMetric(metric);

        taskMetrics.set(task.task_id, { durationMs, tokens: tokensUsed, cost: costUsd });

        // Push to tuner (fire-and-forget)
        if (this.config.tunerUrl) {
          this.pushTaskOutcome(runId, task.task_id, task.step_id, durationMs, tokensUsed, costUsd)
            .catch((err) => {
              console.warn('[TestExecutor] Failed to push task outcome to tuner:', err.message);
            });
        }
      }
    }
  }

  private async finalizeRun(
    runId: string,
    startTime: number,
    taskMetrics: Map<string, { durationMs: number; tokens: number; cost: number }>
  ): Promise<void> {
    const run = this.storage.getRun(runId);
    if (!run) {
      console.error(`[TestExecutor] Run ${runId} not found for finalization`);
      return;
    }

    this.storage.updateRunStatus(runId, RunStatus.Completed);

    const totalDurationSeconds = (Date.now() - startTime) / 1000;
    let totalTokens = 0;
    let totalCost = 0;

    for (const m of taskMetrics.values()) {
      totalTokens += m.tokens;
      totalCost += m.cost;
    }

    const allTasks = this.storage.listTasksByRun(runId);
    const tasksSucceeded = allTasks.filter((t) => t.status === TaskStatus.Completed).length;
    const tasksFailed = allTasks.filter((t) => t.status === TaskStatus.Failed).length;

    console.log(`[TestExecutor] Run ${runId} completed: ${tasksSucceeded}/${allTasks.length} tasks succeeded`);

    if (this.config.tunerUrl) {
      this.pushRunOutcome(
        runId,
        run.plan_id,
        allTasks.length,
        tasksSucceeded,
        tasksFailed,
        totalDurationSeconds,
        totalTokens,
        totalCost
      ).catch((err) => {
        console.warn('[TestExecutor] Failed to push run outcome to tuner:', err.message);
      });
    }
  }

  private randomDelay(): number {
    const { minDelayMs, maxDelayMs } = this.config;
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pushTaskOutcome(
    runId: string,
    taskId: string,
    stepId: string,
    durationMs: number,
    tokensUsed: number,
    costUsd: number
  ): Promise<void> {
    const outcome: TunerTaskOutcome = {
      run_id: runId,
      task_id: taskId,
      step_id: stepId,
      model_used: this.config.modelId,
      complexity_estimate: this.config.complexityEstimate,
      outcome: 'success',
      attempts: 1,
      duration_seconds: durationMs / 1000,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      timestamp: new Date().toISOString(),
      source: this.config.source,
    };

    const res = await fetch(`${this.config.tunerUrl}/api/tuner/outcomes/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcome),
    });

    if (!res.ok) {
      throw new Error(`Tuner API returned ${res.status}`);
    }
  }

  private async pushRunOutcome(
    runId: string,
    planId: string,
    tasksTotal: number,
    tasksSucceeded: number,
    tasksFailed: number,
    totalDurationSeconds: number,
    totalTokens: number,
    totalCostUsd: number
  ): Promise<void> {
    const outcome: TunerRunOutcome = {
      run_id: runId,
      plan_id: planId,
      outcome: 'completed',
      tasks_total: tasksTotal,
      tasks_succeeded: tasksSucceeded,
      tasks_failed: tasksFailed,
      total_duration_seconds: totalDurationSeconds,
      total_tokens: totalTokens,
      total_cost_usd: totalCostUsd,
      replan_count: 0,
      escalation_count: 0,
      timestamp: new Date().toISOString(),
      source: this.config.source,
    };

    const res = await fetch(`${this.config.tunerUrl}/api/tuner/outcomes/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcome),
    });

    if (!res.ok) {
      throw new Error(`Tuner API returned ${res.status}`);
    }
  }
}

export function createTestExecutor(
  storage: ForgeStorage,
  config?: TestExecutorConfig
): TestExecutor {
  return new TestExecutor(storage, config);
}
