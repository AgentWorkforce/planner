/**
 * Orchestrator — Real Task Execution via RunService + Agent Spawning
 *
 * Walks the task DAG, delegating ALL decisions to RunService:
 * - Budget enforcement (BudgetService)
 * - Parallelism control (TaskQueue)
 * - Model selection (ModelSelector)
 * - Confidence validation (ConfidenceHandler)
 * - Failure recovery (TaskFailureHandler)
 * - Timeout enforcement (TaskTimeoutManager)
 * - Artifact validation (ArtifactValidator)
 *
 * Agent spawning is handled by an injected SpawnTaskFn (DI from server).
 */

import type { ForgeStorage } from '../storage/interface.js';
import type { RunService, TaskOutcomeEmission, RunOutcomeEmission } from './run-service.js';
import type { SpawnTaskFn, TerminateAgentFn, SpawnTaskOptions } from './agent-spawner.js';
import type { ForgeConfig } from '../config/forge-config.js';
import { resolveCliConfig } from '../config/forge-config.js';
import {
  RunStatus,
  TaskStatus,
  AttemptOutcome,
  transitionRun,
  transitionTask,
  createTaskAttempt,
  type Task,
  type Run,
  DEFAULT_EXECUTION_POLICY,
} from '../domain/types.js';

// ============================================
// Configuration
// ============================================

export interface OrchestratorConfig {
  /** Storage interface */
  storage: ForgeStorage;
  /** RunService for all DOT Framework decisions */
  runService: RunService;
  /** Function to spawn task agents (injected from server) */
  spawnTask: SpawnTaskFn;
  /** Function to terminate agents (optional) */
  terminateAgent?: TerminateAgentFn;
  /** Forge configuration for CLI/repo mapping */
  forgeConfig?: ForgeConfig;
  /** Polling interval for agent completion checks (ms, default: 2000) */
  pollIntervalMs?: number;
  /** Maximum stall iterations before failing run (default: 50) */
  maxStallIterations?: number;
}

// ============================================
// Agent Completion Tracking
// ============================================

/**
 * Tracks state of running agents for completion detection
 */
interface AgentTracker {
  taskId: string;
  agentId: string;
  startTime: number;
  attemptNumber: number;
}

// ============================================
// Orchestrator
// ============================================

/**
 * Orchestrator executes runs by spawning real agents and delegating
 * all decision-making to RunService.
 */
export class Orchestrator {
  private storage: ForgeStorage;
  private runService: RunService;
  private spawnTask: SpawnTaskFn;
  private terminateAgent?: TerminateAgentFn;
  private forgeConfig?: ForgeConfig;
  private pollIntervalMs: number;
  private maxStallIterations: number;

  // Track active runs and their agent state
  private activeRuns = new Map<string, Map<string, AgentTracker>>();
  private runLoopActive = new Map<string, boolean>();

  constructor(config: OrchestratorConfig) {
    this.storage = config.storage;
    this.runService = config.runService;
    this.spawnTask = config.spawnTask;
    this.terminateAgent = config.terminateAgent;
    this.forgeConfig = config.forgeConfig;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.maxStallIterations = config.maxStallIterations ?? 50;
  }

  /**
   * Entry point: schedule ready tasks for a run.
   * Called by run handler after run creation or gate approval.
   * Kicks off executeRun asynchronously (fire-and-forget).
   */
  scheduleReadyTasks(runId: string): void {
    // Don't spawn duplicate loops
    if (this.runLoopActive.get(runId)) {
      console.log(`[Orchestrator] Run ${runId} already has active loop`);
      return;
    }

    this.runLoopActive.set(runId, true);

    // Execute run in background
    this.executeRun(runId)
      .catch((err) => {
        console.error(`[Orchestrator] Fatal error in run ${runId}:`, err);
        this.failRun(runId, err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        this.runLoopActive.delete(runId);
      });
  }

  /**
   * Core execution loop for a run.
   * Walks the DAG, dispatches tasks, waits for completions, and handles outcomes.
   */
  private async executeRun(runId: string): Promise<void> {
    console.log(`[Orchestrator] Starting execution for run ${runId}`);

    // Get run and initialize
    const run = this.storage.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    // Initialize RunService tracking
    this.runService.initializeRun(run);

    // Transition to running if pending
    if (run.status === RunStatus.Pending) {
      this.storage.updateRunStatus(runId, RunStatus.Running);
    }

    // Initialize agent tracker for this run
    this.activeRuns.set(runId, new Map());

    const startTime = Date.now();
    let stallCount = 0;

    // Main loop
    while (true) {
      // Get current state
      const readyTasks = this.storage.getReadyTasks(runId);
      const allTasks = this.storage.listTasksByRun(runId);
      const runningTasks = allTasks.filter((t) => t.status === TaskStatus.Running);

      // Check if done
      if (readyTasks.length === 0 && runningTasks.length === 0) {
        const pendingTasks = allTasks.filter(
          (t) => t.status === TaskStatus.Pending || t.status === TaskStatus.Queued
        );

        if (pendingTasks.length === 0) {
          // All done
          await this.finalizeRun(runId, startTime);
          return;
        }

        // Stalled: no ready, no running, but have pending
        stallCount++;
        if (stallCount > this.maxStallIterations) {
          console.error(
            `[Orchestrator] Run ${runId} stalled with ${pendingTasks.length} pending tasks`,
            pendingTasks.map((t) => ({ step_id: t.step_id, deps: t.dependencies }))
          );
          this.failRun(runId, 'Run stalled: circular dependencies or blocked tasks');
          return;
        }

        // Wait and retry
        await this.delay(this.pollIntervalMs);
        continue;
      }

      // Reset stall counter when we have work
      if (readyTasks.length > 0 || runningTasks.length > 0) {
        stallCount = 0;
      }

      // Decide which tasks to dispatch
      const decision = this.runService.decideTaskDispatch(readyTasks, runningTasks, runId);

      // Check budget
      if (!decision.budgetOk) {
        console.error(`[Orchestrator] Budget exceeded for run ${runId}: ${decision.warning}`);
        this.failRun(runId, 'Budget exceeded');
        return;
      }

      // Log warnings
      if (decision.warning) {
        console.warn(`[Orchestrator] Run ${runId}: ${decision.warning}`);
      }

      // Log dispatch decisions
      if (decision.blockedByBudget.length > 0) {
        console.log(
          `[Orchestrator] ${decision.blockedByBudget.length} tasks blocked by budget`
        );
      }
      if (decision.blockedByParallelism.length > 0) {
        console.log(
          `[Orchestrator] ${decision.blockedByParallelism.length} tasks blocked by parallelism`
        );
      }
      if (decision.blockedByArtifacts.length > 0) {
        console.log(
          `[Orchestrator] ${decision.blockedByArtifacts.length} tasks blocked by missing artifacts`
        );
      }

      // Dispatch tasks
      for (const taskWithModel of decision.tasksToDispatch) {
        await this.dispatchTask(taskWithModel.task, runId, taskWithModel.modelSelection.model);
      }

      // Wait for some completions
      await this.delay(this.pollIntervalMs);

      // Check for completed/failed tasks
      await this.checkCompletions(runId);
    }
  }

  /**
   * Dispatches a single task to an agent.
   */
  private async dispatchTask(task: Task, runId: string, recommendedModel: string): Promise<void> {
    console.log(`[Orchestrator] Dispatching task ${task.step_id} (${task.task_id})`);

    // Resolve CLI config (by owner_role from plan step)
    const executionPolicy = this.storage.getRun(runId)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;
    const cliConfig = this.forgeConfig
      ? resolveCliConfig(this.forgeConfig, task.owner_role)
      : { cli: 'claude', timeout: executionPolicy.budgets.per_task_time_seconds };

    // Build spawn options
    const spawnOptions: SpawnTaskOptions = {
      taskId: task.task_id,
      runId: task.run_id,
      stepTitle: task.step_title,
      stepDescription: task.step_description,
      scope: task.scope,
      ownerRole: task.owner_role,
      workspacePath: task.workspace_path,
      cli: cliConfig?.cli ?? 'claude',
      model: recommendedModel,
      timeout: cliConfig?.timeout ?? executionPolicy.budgets.per_task_time_seconds,
      acceptanceCriteria: task.acceptance_criteria,
    };

    // Transition to running
    this.storage.updateTaskStatus(task.task_id, TaskStatus.Running);

    // Create attempt record
    const attemptNumber = (task.current_attempt ?? 0) + 1;
    const attempt = createTaskAttempt(task.task_id, attemptNumber);
    this.storage.createAttempt(attempt);
    this.storage.updateTask(task.task_id, { current_attempt: attemptNumber });

    // Track start with RunService
    this.runService.trackTaskStart(task, runId, executionPolicy);

    // Spawn agent
    try {
      const result = await this.spawnTask(spawnOptions);

      // Store agent ID
      this.storage.updateTask(task.task_id, { agent_id: result.agentId });

      // Track in local map
      const agentTracker: AgentTracker = {
        taskId: task.task_id,
        agentId: result.agentId,
        startTime: Date.now(),
        attemptNumber,
      };
      this.activeRuns.get(runId)?.set(task.task_id, agentTracker);

      console.log(`[Orchestrator] Spawned agent ${result.agentId} for task ${task.step_id}`);
    } catch (err) {
      console.error(`[Orchestrator] Failed to spawn agent for task ${task.task_id}:`, err);

      // Mark task as failed
      this.storage.updateTaskStatus(task.task_id, TaskStatus.Failed);

      // Handle failure via RunService
      await this.runService.handleTaskFailure(
        task,
        runId,
        attemptNumber,
        err instanceof Error ? err.message : String(err),
        executionPolicy
      );
    }
  }

  /**
   * Checks for completed or failed tasks.
   * In a real implementation, agents would report back via API or relay.
   * For now, we poll task status.
   */
  private async checkCompletions(runId: string): Promise<void> {
    const agentTrackers = this.activeRuns.get(runId);
    if (!agentTrackers) return;

    for (const [taskId, tracker] of agentTrackers.entries()) {
      const task = this.storage.getTask(taskId);
      if (!task) continue;

      // Check if task status changed (agent finished)
      if (task.status === TaskStatus.Completed) {
        await this.handleTaskCompletion(task, runId, tracker);
        agentTrackers.delete(taskId);
      } else if (task.status === TaskStatus.Failed) {
        await this.handleTaskFailure(task, runId, tracker);
        agentTrackers.delete(taskId);
      }
    }
  }

  /**
   * Handles a completed task.
   */
  private async handleTaskCompletion(
    task: Task,
    runId: string,
    tracker: AgentTracker
  ): Promise<void> {
    console.log(`[Orchestrator] Task ${task.step_id} completed`);

    const durationMs = Date.now() - tracker.startTime;

    // Generate synthetic usage (in real deployment, get from agent)
    const tokensUsed = Math.floor(Math.random() * 5000) + 1000;
    const costUsd = tokensUsed * 0.000003;
    const confidence = 0.95;

    // Validate with RunService
    const result = this.runService.handleTaskCompletion(task, runId, confidence, {
      tokens: tokensUsed,
      cost: costUsd,
      duration_ms: durationMs,
      model_id: 'sonnet', // TODO: get actual model from tracker
    });

    if (!result.accepted) {
      console.warn(
        `[Orchestrator] Task ${task.step_id} completion rejected: ${result.message}`
      );
      // Confidence handler may have already marked for retry/escalation
      return;
    }

    // Record artifacts
    await this.runService.recordTaskArtifacts(task, runId);

    // Emit outcome to tuner
    const outcome: TaskOutcomeEmission = {
      run_id: runId,
      task_id: task.task_id,
      step_id: task.step_id,
      model_used: 'sonnet', // TODO: actual model (forge-agent-metrics)
      complexity_estimate: 'simple', // TODO: from plan
      outcome: 'success',
      attempts: tracker.attemptNumber,
      duration_seconds: durationMs / 1000,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      confidence_score: confidence,
      timestamp: new Date().toISOString(),
      source: 'production',
    };

    await this.runService.emitTaskOutcome(outcome);

    console.log(`[Orchestrator] Task ${task.step_id} completed successfully`);
  }

  /**
   * Handles a failed task.
   */
  private async handleTaskFailure(
    task: Task,
    runId: string,
    tracker: AgentTracker
  ): Promise<void> {
    console.error(`[Orchestrator] Task ${task.step_id} failed`);

    const durationMs = Date.now() - tracker.startTime;
    const executionPolicy = this.storage.getRun(runId)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;

    // Let RunService apply recovery ladder
    await this.runService.handleTaskFailure(
      task,
      runId,
      tracker.attemptNumber,
      'Task execution failed', // TODO: get actual error from agent
      executionPolicy
    );

    // Emit failure outcome to tuner
    const outcome: TaskOutcomeEmission = {
      run_id: runId,
      task_id: task.task_id,
      step_id: task.step_id,
      model_used: 'sonnet', // TODO: actual model (forge-agent-metrics)
      complexity_estimate: 'simple', // TODO: from plan
      outcome: 'failure',
      attempts: tracker.attemptNumber,
      duration_seconds: durationMs / 1000,
      tokens_used: 0,
      cost_usd: 0,
      error_category: 'agent_failure',
      timestamp: new Date().toISOString(),
      source: 'production',
    };

    await this.runService.emitTaskOutcome(outcome);
  }

  /**
   * Finalizes a run after all tasks complete.
   */
  private async finalizeRun(runId: string, startTime: number): Promise<void> {
    const run = this.storage.getRun(runId);
    if (!run) {
      console.error(`[Orchestrator] Run ${runId} not found for finalization`);
      return;
    }

    // Update run status
    this.storage.updateRunStatus(runId, RunStatus.Completed);

    // Calculate metrics
    const allTasks = this.storage.listTasksByRun(runId);
    const tasksSucceeded = allTasks.filter((t) => t.status === TaskStatus.Completed).length;
    const tasksFailed = allTasks.filter((t) => t.status === TaskStatus.Failed).length;
    const totalDurationSeconds = (Date.now() - startTime) / 1000;

    // Get budget totals from storage
    const budget = this.storage.getRunBudget(runId);
    const totalTokens = budget?.tokens_used ?? 0;
    const totalCostUsd = budget?.cost_used_usd ?? 0;

    console.log(
      `[Orchestrator] Run ${runId} completed: ${tasksSucceeded}/${allTasks.length} tasks succeeded`
    );

    // Emit run outcome to tuner
    const outcome: RunOutcomeEmission = {
      run_id: runId,
      plan_id: run.plan_id,
      outcome: 'completed',
      tasks_total: allTasks.length,
      tasks_succeeded: tasksSucceeded,
      tasks_failed: tasksFailed,
      total_duration_seconds: totalDurationSeconds,
      total_tokens: totalTokens,
      total_cost_usd: totalCostUsd,
      replan_count: 0,       // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
      escalation_count: 0,   // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
      timestamp: new Date().toISOString(),
      source: 'production',
    };

    await this.runService.emitRunOutcome(outcome);

    // Clean up agent trackers
    this.activeRuns.delete(runId);
  }

  /**
   * Fails a run with an error message.
   */
  private failRun(runId: string, error: string): void {
    console.error(`[Orchestrator] Failing run ${runId}: ${error}`);

    const run = this.storage.getRun(runId);
    if (!run) return;

    this.storage.updateRun(runId, {
      status: RunStatus.Failed,
      error,
      completed_at: new Date().toISOString(),
    });

    // Emit run outcome
    const allTasks = this.storage.listTasksByRun(runId);
    const tasksSucceeded = allTasks.filter((t) => t.status === TaskStatus.Completed).length;
    const tasksFailed = allTasks.filter((t) => t.status === TaskStatus.Failed).length;

    const budget = this.storage.getRunBudget(runId);

    const outcome: RunOutcomeEmission = {
      run_id: runId,
      plan_id: run.plan_id,
      outcome: 'failed',
      tasks_total: allTasks.length,
      tasks_succeeded: tasksSucceeded,
      tasks_failed: tasksFailed,
      total_duration_seconds: 0, // Unknown
      total_tokens: budget?.tokens_used ?? 0,
      total_cost_usd: budget?.cost_used_usd ?? 0,
      replan_count: 0,       // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
      escalation_count: 0,   // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
      timestamp: new Date().toISOString(),
      source: 'production',
    };

    this.runService.emitRunOutcome(outcome).catch((err) => {
      console.warn('[Orchestrator] Failed to emit run outcome:', err);
    });

    // Clean up agent trackers
    this.activeRuns.delete(runId);
  }

  /**
   * Delays execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Shuts down the orchestrator.
   * Call this when the Forge server is shutting down.
   */
  shutdown(): void {
    console.log('[Orchestrator] Shutting down');

    // Terminate all active agents
    for (const [runId, agentTrackers] of this.activeRuns.entries()) {
      for (const [taskId, tracker] of agentTrackers.entries()) {
        if (this.terminateAgent) {
          this.terminateAgent(tracker.agentId).catch((err) => {
            console.error(
              `[Orchestrator] Failed to terminate agent ${tracker.agentId}:`,
              err
            );
          });
        }
      }
    }

    // Clear tracking state
    this.activeRuns.clear();
    this.runLoopActive.clear();
  }
}

// ============================================
// Factory
// ============================================

/**
 * Factory function to create Orchestrator.
 */
export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}
