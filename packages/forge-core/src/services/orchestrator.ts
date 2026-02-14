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

import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path, { join, relative } from 'node:path';
import { promisify } from 'node:util';

import type { ForgeStorage } from '../storage/interface.js';
import type { RunService, TaskOutcomeEmission, RunOutcomeEmission } from './run-service.js';
import { estimateComplexityLevel } from './complexity-estimator.js';

const execFileAsync = promisify(execFile);
import type { SpawnTaskFn, TerminateAgentFn, SpawnTaskOptions, AgentExitInfo, SpawnGateAgentFn } from './agent-spawner.js';
import type { ForgeConfig } from '../config/forge-config.js';
import { resolveCliConfig, createDefaultConfig } from '../config/forge-config.js';
import {
  RunStatus,
  TaskStatus,
  AttemptOutcome,
  transitionRun,
  transitionTask,
  createTaskAttempt,
  createRun,
  createTask,
  type Task,
  type Run,
  type ForgePlan,
  type QualityConfig,
  DEFAULT_EXECUTION_POLICY,
  MASTER_RUN_PARALLELISM,
} from '../domain/types.js';
import { PlannerClient } from '../adapters/planner-client.js';
import { transformToForgePlan } from '../adapters/plan-transformer.js';
import { computeDependencyTiers } from '../adapters/plan-validator.js';
import type { WorktreeManager } from './worktree-manager.js';
import type { AnalysisResult } from './analysis-tool.js';

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
  /** PlannerClient for fetching sub-plans (required for sub_plan_id support) */
  plannerClient?: PlannerClient;
  /** WorktreeManager for git worktree isolation (optional) */
  worktreeManager?: WorktreeManager;
  /** SpawnGateAgentFn for relay-based quality gates (subscription billing) */
  spawnGateAgent?: SpawnGateAgentFn;
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
  pid?: number; // OS process ID for liveness detection
  startTime: number;
  attemptNumber: number;
  model: string; // Model used for the task (e.g., 'sonnet', 'opus')
  errorMessage?: string; // Error message if task failed
}

/**
 * Tracks child runs spawned from sub_plan_id steps.
 * The parent task waits for the child run to complete.
 */
interface ChildRunTracker {
  parentTaskId: string;
  parentRunId: string;
  childRunId: string;
  startTime: number;
}

// ============================================
// TASK_POST Result Type
// ============================================

interface TaskPostResult {
  passed: boolean;
  reason?: string;
  findings: Record<string, unknown>;
  verification?: {
    tests_passed?: boolean | null;
    build_passed?: boolean | null;
    type_check_passed?: boolean | null;
    lint_passed?: boolean | null;
  };
  ac_results?: Array<{ ac_id: string; passed: boolean; evidence?: string }>;
  /** Severity classification for retry behavior (fix_issues or clean_restart) */
  severity?: 'fix_issues' | 'clean_restart';
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
  private plannerClient?: PlannerClient;
  private worktreeManager?: WorktreeManager;
  private spawnGateAgent?: SpawnGateAgentFn;
  private pollIntervalMs: number;
  private maxStallIterations: number;

  // Track active runs and their agent state
  private activeRuns = new Map<string, Map<string, AgentTracker>>();
  private runLoopActive = new Map<string, boolean>();
  // Track child runs spawned from sub_plan_id steps
  private childRunTrackers = new Map<string, ChildRunTracker>();
  // Track worktree paths per run for cleanup
  private runWorktrees = new Map<string, string>();
  // Track dependency tier maps per run (step_id → tier number)
  private runTierMaps = new Map<string, Map<string, number>>();
  /** Maps buildId → Set of runIds sharing scope coordination */
  private buildRunRegistry = new Map<string, Set<string>>();

  constructor(config: OrchestratorConfig) {
    this.storage = config.storage;
    this.runService = config.runService;
    this.spawnTask = config.spawnTask;
    this.terminateAgent = config.terminateAgent;
    this.forgeConfig = config.forgeConfig;
    this.plannerClient = config.plannerClient;
    this.worktreeManager = config.worktreeManager;
    this.spawnGateAgent = config.spawnGateAgent;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.maxStallIterations = config.maxStallIterations ?? 50;

    // Wire retry function to RunService
    this.runService.setRetryTaskFn(this.retryTask.bind(this));
  }

  private get hasQualityGateMechanism(): boolean {
    return !!this.spawnGateAgent;
  }

  private async runQualityGate(
    prompt: string,
    options: { model?: string; cwd?: string; timeoutMs?: number; retries?: number }
  ): Promise<AnalysisResult> {
    if (!this.spawnGateAgent) {
      throw new Error('Quality gate requires spawnGateAgent (relay connection) — no fallback');
    }
    return this.runGateViaRelay(prompt, options);
  }

  private async runGateViaRelay(
    prompt: string,
    options: { model?: string; cwd?: string; timeoutMs?: number }
  ): Promise<AnalysisResult> {
    const gateId = randomUUID();
    const resultFile = `/tmp/gate-${gateId}.json`;
    const timeoutMs = options?.timeoutMs ?? 120000;
    const startTime = Date.now();

    return new Promise<AnalysisResult>((resolve, reject) => {
      let timeoutHandle: ReturnType<typeof setTimeout>;
      let pollHandle: ReturnType<typeof setInterval>;
      let settled = false;
      let spawnResult: { agentId: string; pid?: number } | undefined;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        clearInterval(pollHandle);
        fn();
      };

      const tryReadResult = (): AnalysisResult | null => {
        try {
          if (!existsSync(resultFile)) return null;
          const content = readFileSync(resultFile, 'utf8');
          const parsed = JSON.parse(content);
          try { unlinkSync(resultFile); } catch {}
          return {
            output: content,
            parsed,
            durationMs: Date.now() - startTime,
            model: options?.model ?? 'sonnet',
          };
        } catch {
          return null;
        }
      };

      const killAgent = () => {
        if (this.terminateAgent && spawnResult?.agentId) {
          this.terminateAgent(spawnResult.agentId).catch(() => {});
        }
      };

      const onExited = (_exitCode: number | null) => {
        settle(() => {
          const result = tryReadResult();
          if (result) {
            resolve(result);
          } else {
            reject(new Error(
              `Gate agent exited (code=${_exitCode}) but no valid result file at ${resultFile}`
            ));
          }
        });
      };

      this.spawnGateAgent!({
        gateId,
        prompt,
        cwd: options?.cwd,
        model: options?.model,
      }, onExited).then(result => {
        spawnResult = result;

        // Poll for result file every 5s — gate agent may write file before exiting
        pollHandle = setInterval(() => {
          const gateResult = tryReadResult();
          if (gateResult) {
            settle(() => {
              killAgent();
              resolve(gateResult);
            });
          }
        }, 5000);

        timeoutHandle = setTimeout(() => {
          settle(() => {
            killAgent();
            const gateResult = tryReadResult();
            if (gateResult) {
              resolve(gateResult);
            } else {
              reject(new Error(`Gate agent timed out after ${timeoutMs}ms`));
            }
          });
        }, timeoutMs);
      }).catch(err => {
        settle(() => reject(err));
      });
    });
  }

  /**
   * Registers a run as part of a build for cross-run scope coordination.
   * All runs in the same build share scope exclusivity via the TaskQueue.
   */
  registerBuildRun(buildId: string, runId: string): void {
    let runs = this.buildRunRegistry.get(buildId);
    if (!runs) {
      runs = new Set();
      this.buildRunRegistry.set(buildId, runs);
    }
    runs.add(runId);
  }

  /**
   * Retries a failed task by resetting its status and creating a new attempt.
   * This function is wired to RunService's TaskFailureHandler for automatic retry.
   */
  private async retryTask(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      console.error(`[Orchestrator] Cannot retry task ${taskId}: not found`);
      return;
    }

    const currentAttempt = task.current_attempt ?? 0;
    const executionPolicy = this.storage.getRun(task.run_id)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;
    const maxRetries = executionPolicy.retry.max_retries_per_task;

    // Check if retries remain
    if (currentAttempt >= maxRetries) {
      console.log(
        `[Orchestrator] Cannot retry task ${task.step_id}: max retries (${maxRetries}) exceeded`
      );
      return;
    }

    console.log(
      `[Orchestrator] Retrying task ${task.step_id} (attempt ${currentAttempt + 1}/${maxRetries})`
    );

    // Reset task to pending so it gets picked up by getReadyTasks
    this.storage.updateTask(taskId, {
      status: TaskStatus.Pending,
    });

    // Remove from active agents tracking if present
    const agents = this.activeRuns.get(task.run_id);
    if (agents) {
      agents.delete(taskId);
    }
  }

  /**
   * Recover runs that were in progress when the server last shut down.
   * Called once during server startup after orchestrator initialization.
   */
  async recoverRunningRuns(): Promise<void> {
    // Find all runs with status "running"
    const allRuns = this.storage.listRuns(RunStatus.Running);

    if (allRuns.length === 0) return;

    console.log(`[Orchestrator] Recovering ${allRuns.length} running run(s) from previous instance`);

    for (const run of allRuns) {
      try {
        // Check if workspace_path exists — if it was deleted, clear it for fresh worktree
        if (run.workspace_path && !existsSync(run.workspace_path)) {
          console.log(
            `[Orchestrator] Run ${run.run_id} has stale workspace_path (${run.workspace_path}) — clearing for fresh worktree`
          );
          // Clear the run's workspace_path
          this.storage.updateRun(run.run_id, { workspace_path: undefined });
          // Clear workspace_path for all tasks in this run
          const allTasksInRun = this.storage.listTasksByRun(run.run_id);
          for (const task of allTasksInRun) {
            this.storage.updateTask(task.task_id, { workspace_path: undefined });
          }
        } else if (run.workspace_path && existsSync(run.workspace_path)) {
          // Workspace exists — track it in the in-memory map
          this.runWorktrees.set(run.run_id, run.workspace_path);
        }

        // Check if any tasks are still "running" — these agents are dead (server restarted)
        const tasks = this.storage.listTasksByRun(run.run_id);
        const runningTasks = tasks.filter((t) => t.status === TaskStatus.Running);

        // Reset running tasks to pending (their agents are dead)
        for (const task of runningTasks) {
          this.storage.updateTask(task.task_id, { status: TaskStatus.Pending });
          console.log(`[Orchestrator] Reset orphaned task ${task.step_id} to pending`);
        }

        // Re-start execution for this run (only if not already active)
        if (!this.runLoopActive.get(run.run_id)) {
          this.scheduleReadyTasks(run.run_id);
          console.log(`[Orchestrator] Recovered run ${run.run_id}`);
        }
      } catch (err) {
        console.error(`[Orchestrator] Failed to recover run ${run.run_id}:`, err);
      }
    }
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
   * Gets running tasks from sister runs (same build).
   * Used so the TaskQueue sees cross-run scope occupancy.
   */
  private getSisterRunningTasks(runId: string): Task[] {
    // Find which build this run belongs to
    for (const [_buildId, runIds] of this.buildRunRegistry) {
      if (runIds.has(runId)) {
        // Collect running tasks from ALL sister runs
        const sisterTasks: Task[] = [];
        for (const sisterRunId of runIds) {
          if (sisterRunId === runId) continue; // skip self
          const sisterAgents = this.activeRuns.get(sisterRunId);
          if (sisterAgents) {
            for (const [taskId] of sisterAgents) {
              const task = this.storage.getTask(taskId);
              if (task) sisterTasks.push(task);
            }
          }
        }
        return sisterTasks;
      }
    }
    return [];
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

    // Create git worktree for isolation — agents should never write to main checkout
    // Skip worktree creation if run already has workspace_path set (from BuildCoordinator)
    if (this.worktreeManager && !run.workspace_path) {
      try {
        const worktreePath = await this.worktreeManager.create(runId);
        this.runWorktrees.set(runId, worktreePath);
        this.storage.updateRun(runId, { workspace_path: worktreePath });
        // Update all existing tasks with the worktree path
        const tasks = this.storage.listTasksByRun(runId);
        for (const task of tasks) {
          this.storage.updateTask(task.task_id, { workspace_path: worktreePath });
        }
        console.log(`[Orchestrator] Run ${runId} using worktree at ${worktreePath}`);
      } catch (err) {
        console.error(`[Orchestrator] Failed to create worktree for run ${runId}:`, err);
        // Continue without worktree — falls back to run's workspace_path or cwd
      }
    }

    // Transition to running if pending
    if (run.status === RunStatus.Pending) {
      this.storage.updateRunStatus(runId, RunStatus.Running);
    }

    // Initialize agent tracker for this run
    this.activeRuns.set(runId, new Map());

    // Compute dependency tiers from the DAG
    const allTasksInitial = this.storage.listTasksByRun(runId);
    const forgeSteps = allTasksInitial.map((t) => ({
      step_id: t.step_id,
      title: t.step_title,
      dependencies: t.dependencies,
    }));
    const tierMap = computeDependencyTiers(forgeSteps as any);
    if (tierMap) {
      this.runTierMaps.set(runId, tierMap);
      const maxTier = Math.max(...tierMap.values(), 0);
      console.log(`[Orchestrator] Run ${runId} has ${maxTier + 1} dependency tiers`);
    }

    // Master-run auto-detection: if all tasks dispatch child runs (have sub_plan_id),
    // relax parallelism since master run tasks don't edit files directly.
    // User-provided execution_policy always takes precedence.
    if (allTasksInitial.length > 0 && allTasksInitial.every(t => t.sub_plan_id)) {
      if (!run.execution_policy) {
        // No user-provided policy — apply master-run defaults
        this.runService.updateParallelism(MASTER_RUN_PARALLELISM);
        console.log(`[Orchestrator] Detected master run ${runId} — relaxed parallelism for sub-plan dispatch (prefer_sequential=false, max_per_scope=3)`);
      } else {
        console.log(`[Orchestrator] Detected master run ${runId} — using user-provided execution policy`);
      }
    }

    // Get quality config from execution policy
    const executionPolicy = run.execution_policy ?? DEFAULT_EXECUTION_POLICY;
    const qualityConfig: QualityConfig = (executionPolicy as any).quality ?? {};

    const startTime = Date.now();
    let stallCount = 0;
    let lastPrepTier = -1; // Track which tier we last ran PREP for
    let lastLoggedParallelismBlocked = 0; // Avoid spamming "blocked by parallelism"
    let prepInProgress = false; // Track if PREP is currently running in background
    const tasksAwaitingPrep = new Set<string>(); // Tasks that should wait for PREP to complete

    // Main loop
    while (true) {
      // Check if run was cancelled/failed externally (e.g., build cancel)
      const currentRun = this.storage.getRun(runId);
      if (!currentRun || currentRun.status === 'cancelled' || currentRun.status === 'failed') {
        console.log(`[Orchestrator] Run ${runId} was ${currentRun?.status ?? 'deleted'} externally, stopping`);
        return;
      }

      // Check for timed-out tasks
      const timeoutManager = this.runService.getTaskTimeoutManager();
      const timedOutTasks = timeoutManager.getAllTaskTimeouts()
        .filter((result) => result.isTimedOut);

      for (const timeoutResult of timedOutTasks) {
        const task = this.storage.getTask(timeoutResult.taskId);
        if (task && task.status === TaskStatus.Running) {
          const timeoutSeconds = Math.round(timeoutResult.elapsedMs / 1000);
          console.error(
            `[Orchestrator] Task ${task.step_id} (${task.task_id}) timed out after ${timeoutSeconds}s`
          );

          // Mark task as failed
          this.storage.updateTaskStatus(task.task_id, TaskStatus.Failed);

          // Update attempt record with timeout
          const attempts = this.storage.listAttemptsByTask(task.task_id);
          if (attempts.length > 0) {
            const lastAttempt = attempts[attempts.length - 1]!;
            this.storage.updateAttempt(lastAttempt.attempt_id, {
              outcome: AttemptOutcome.Timeout,
              error: `Task timed out after ${timeoutSeconds}s`,
            });
          }

          // Remove from active tracking
          const agents = this.activeRuns.get(runId);
          if (agents) {
            agents.delete(task.task_id);
          }

          // Untrack from timeout manager (will be done by handleTimeout but be explicit)
          timeoutManager.untrackTask(task.task_id);
        }
      }

      // Get current state
      const readyTasks = this.storage.getReadyTasks(runId);
      const allTasks = this.storage.listTasksByRun(runId);
      const runningTasks = allTasks.filter((t) => t.status === TaskStatus.Running);

      // Check if done
      if (readyTasks.length === 0 && runningTasks.length === 0) {
        const pendingTasks = allTasks.filter(
          (t) => t.status === TaskStatus.Pending || t.status === TaskStatus.Queued
        );
        const completedTasks = allTasks.filter((t) => t.status === TaskStatus.Completed);
        const failedTasks = allTasks.filter((t) => t.status === TaskStatus.Failed);

        if (pendingTasks.length === 0) {
          // All tasks resolved (either completed or failed)
          if (failedTasks.length === 0) {
            // All succeeded
            await this.finalizeRun(runId, startTime);
            return;
          } else {
            // Some failed — finalize with descriptive error
            const failedStepIds = failedTasks.map((t) => t.step_id).join(', ');
            this.failRun(
              runId,
              `Completed with failures: ${completedTasks.length}/${allTasks.length} succeeded, ` +
              `${failedTasks.length} failed (${failedStepIds})`
            );
            return;
          }
        }

        // No ready, no running, but have pending → analyze why
        // Compute transitive blocked set: tasks blocked by failures through any dep chain
        const failedStepIds = new Set(failedTasks.map((t) => t.step_id));
        const transitivelyBlocked = new Set(failedStepIds);

        // Iteratively expand: if any dep is in the blocked set, the task is also blocked
        let changed = true;
        while (changed) {
          changed = false;
          for (const task of pendingTasks) {
            if (transitivelyBlocked.has(task.step_id)) continue;
            if (task.dependencies.some((depId) => transitivelyBlocked.has(depId))) {
              transitivelyBlocked.add(task.step_id);
              changed = true;
            }
          }
        }

        const blockedTasks = pendingTasks.filter((t) => transitivelyBlocked.has(t.step_id));
        const stuckTasks = pendingTasks.filter((t) => !transitivelyBlocked.has(t.step_id));

        if (blockedTasks.length > 0 && stuckTasks.length === 0) {
          // ALL pending tasks are transitively blocked by failures → cascading failure
          console.log(
            `[Orchestrator] Cascading failure detected: ${blockedTasks.length} tasks blocked by upstream failures`
          );

          // Mark blocked tasks as failed with clear message
          for (const task of blockedTasks) {
            const failedDeps = task.dependencies.filter((depId) => transitivelyBlocked.has(depId));
            const blockMsg = `Blocked: upstream task${failedDeps.length > 1 ? 's' : ''} ${failedDeps.join(', ')} failed`;

            this.storage.updateTask(task.task_id, { status: TaskStatus.Failed });

            const attempts = this.storage.listAttemptsByTask(task.task_id);
            if (attempts.length > 0) {
              const lastAttempt = attempts[attempts.length - 1]!;
              this.storage.updateAttempt(lastAttempt.attempt_id, {
                outcome: AttemptOutcome.Failure,
                error: blockMsg,
              });
            }
          }

          const blockedStepIds = blockedTasks.map((t) => t.step_id).join(', ');
          this.failRun(
            runId,
            `Cascading failure: ${completedTasks.length}/${allTasks.length} succeeded, ` +
            `${failedTasks.length} failed, ${blockedTasks.length} blocked (${blockedStepIds})`
          );
          return;
        }

        // Some pending tasks are not blocked by failures → possible circular dependency
        stallCount++;
        if (stallCount > this.maxStallIterations) {
          console.error(
            `[Orchestrator] Run ${runId} stalled with ${stuckTasks.length} stuck tasks (possible circular dependencies)`,
            stuckTasks.map((t) => ({ step_id: t.step_id, deps: t.dependencies }))
          );

          this.failRun(
            runId,
            `Run stalled: ${stuckTasks.length} tasks stuck with possible circular dependencies. ` +
            `Stuck tasks: ${stuckTasks.map((t) => t.step_id).join(', ')}`
          );
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

      // Detect tier boundary: no tasks running, new tasks ready → potential tier transition
      if (runningTasks.length === 0 && readyTasks.length > 0 && tierMap && !prepInProgress) {
        const currentTier = Math.min(
          ...readyTasks.map((t) => tierMap.get(t.step_id) ?? 0)
        );

        // Count tasks in this tier and categorize by complexity
        const currentTierTasks = readyTasks.filter(
          (t) => (tierMap.get(t.step_id) ?? 0) === currentTier
        );
        const minTierTasks = qualityConfig.prep_min_tier_tasks ?? 2;

        if (currentTier > lastPrepTier && this.hasQualityGateMechanism && qualityConfig.prep_enabled !== false
            && allTasks.length >= (qualityConfig.prep_min_tasks ?? 3)
            && currentTierTasks.length >= minTierTasks) {
          // Optimization: Categorize tasks by complexity
          const simpleTasks: Task[] = [];
          const complexTasks: Task[] = [];

          for (const task of currentTierTasks) {
            const complexity = estimateComplexityLevel(task);
            if (complexity === 'trivial' || complexity === 'simple') {
              simpleTasks.push(task);
            } else {
              complexTasks.push(task);
            }
          }

          // Skip PREP entirely if all tasks are trivial/simple
          if (complexTasks.length === 0) {
            console.log(
              `[Orchestrator] Skipping PREP for tier ${currentTier} — all ${currentTierTasks.length} tasks are trivial/simple`
            );
            lastPrepTier = currentTier;
          } else {
            // Mark complex tasks as awaiting PREP, run PREP in background
            for (const task of complexTasks) {
              tasksAwaitingPrep.add(task.step_id);
            }

            prepInProgress = true;
            const prepPromise = this.runPrepPhase(runId, readyTasks, currentTier, tierMap, qualityConfig);
            lastPrepTier = currentTier;

            console.log(
              `[Orchestrator] Starting PREP for tier ${currentTier} in background (${complexTasks.length} complex, ${simpleTasks.length} simple tasks)`
            );

            // Run PREP in background, mark complete when done
            prepPromise
              .then(() => {
                // Clear awaiting set - complex tasks can now proceed
                tasksAwaitingPrep.clear();
                prepInProgress = false;
                console.log(`[Orchestrator] PREP complete for tier ${currentTier} — releasing complex tasks`);
              })
              .catch((err) => {
                console.error(`[Orchestrator] PREP failed for tier ${currentTier}:`, err);
                // Clear anyway - don't block tasks forever on PREP failure
                tasksAwaitingPrep.clear();
                prepInProgress = false;
              });
          }
        }
      }

      // Decide which tasks to dispatch
      // Filter out tasks awaiting PREP (complex tasks in a tier where PREP is still running)
      const readyAndUnblocked = readyTasks.filter((t) => !tasksAwaitingPrep.has(t.step_id));

      // Include running tasks from sister runs (same build) for cross-run scope coordination
      const sisterRunning = this.getSisterRunningTasks(runId);
      const allRunningTasks = [...runningTasks, ...sisterRunning];
      const decision = this.runService.decideTaskDispatch(readyAndUnblocked, allRunningTasks, runId);

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
      if (decision.blockedByParallelism.length > 0 && decision.blockedByParallelism.length !== lastLoggedParallelismBlocked) {
        console.log(
          `[Orchestrator] ${decision.blockedByParallelism.length} tasks blocked by parallelism`
        );
        lastLoggedParallelismBlocked = decision.blockedByParallelism.length;
      } else if (decision.blockedByParallelism.length === 0) {
        lastLoggedParallelismBlocked = 0;
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
   * Computes baseline scope boundary from plan data.
   * Used when PREP didn't run for a task's scope — ensures workers still know what's off-limits.
   */
  private computeBaseScopeBoundary(
    currentTask: Task,
    allTasks: Task[]
  ): { owned_paths: string[]; do_not_touch: string[] } {
    const ownedPaths: string[] = [];
    const doNotTouch: string[] = [];

    // Current task owns its target_path
    if (currentTask.target_path) {
      ownedPaths.push(currentTask.target_path);
    }

    // All other scopes' target_paths are off-limits
    const currentScope = currentTask.scope ?? 'default';
    for (const task of allTasks) {
      if (!task.target_path) continue;

      const taskScope = task.scope ?? 'default';
      if (taskScope !== currentScope) {
        // Different scope — this is off-limits
        doNotTouch.push(task.target_path);
      }
    }

    // Common shared paths that need caution (derived heuristic)
    const sharedPaths = [
      'packages/shared-ui',
      'packages/storage-base',
      'packages/errors',
      'domain/types.ts',
      'shared/',
    ];

    // Add shared paths if they're not already in owned_paths
    for (const sharedPath of sharedPaths) {
      if (!ownedPaths.includes(sharedPath) && !doNotTouch.includes(sharedPath)) {
        doNotTouch.push(sharedPath);
      }
    }

    // Deduplicate
    return {
      owned_paths: [...new Set(ownedPaths)],
      do_not_touch: [...new Set(doNotTouch)],
    };
  }

  /**
   * Dispatches a single task to an agent, or creates a child run for sub-plan steps.
   */
  private async dispatchTask(task: Task, runId: string, recommendedModel: string): Promise<void> {
    // If task has a sub_plan_id, create a child run instead of spawning an agent
    if (task.sub_plan_id) {
      await this.dispatchSubPlanTask(task, runId);
      return;
    }

    console.log(`[Orchestrator] Dispatching task ${task.step_id} (${task.task_id})`);

    // Resolve CLI config (by owner_role from plan step)
    const executionPolicy = this.storage.getRun(runId)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;
    const cliConfig = this.forgeConfig
      ? resolveCliConfig(this.forgeConfig, task.owner_role)
      : { cli: 'claude', timeout: executionPolicy.budgets.per_task_time_seconds };

    // Get plan-level context and understanding from the run document
    const runDoc = this.storage.getRunDocument(runId);

    // Pull PREP context for this task's scope/tier — extract only this task's guidance
    const tierMap = this.runTierMaps.get(runId);
    const tier = tierMap?.get(task.step_id) ?? 0;
    const prepKey = `prep_${task.scope ?? 'default'}_tier${tier}`;
    const fullPrep = runDoc?.[prepKey] as Record<string, unknown> | undefined;

    // Extract task-specific prep: scope boundary + this task's guidance + warnings
    let prepFindings: Record<string, unknown> | undefined;
    if (fullPrep) {
      const taskGuidance = (fullPrep as any)?.task_guidance?.[task.step_id];
      prepFindings = {
        ...(fullPrep.scope_boundary ? { scope_boundary: fullPrep.scope_boundary } : {}),
        ...(fullPrep.existing_patterns ? { existing_patterns: fullPrep.existing_patterns } : {}),
        ...(taskGuidance ? { task_guidance: taskGuidance } : {}),
        ...(fullPrep.warnings ? { warnings: fullPrep.warnings } : {}),
      };
      // Don't pass empty object
      if (Object.keys(prepFindings).length === 0) prepFindings = undefined;
    }

    // If no PREP findings, compute baseline scope boundary from plan data
    if (!prepFindings || !prepFindings.scope_boundary) {
      const allTasks = this.storage.listTasksByRun(runId);
      const baseBoundary = this.computeBaseScopeBoundary(task, allTasks);

      // Merge with existing prepFindings (PREP takes precedence for overlaps)
      if (prepFindings) {
        prepFindings.scope_boundary = baseBoundary;
      } else {
        prepFindings = { scope_boundary: baseBoundary };
      }

      console.log(
        `[Orchestrator] Task ${task.step_id}: computed baseline scope boundary (${baseBoundary.do_not_touch.length} paths off-limits)`
      );
    }

    // Build spawn options
    const spawnOptions: SpawnTaskOptions = {
      taskId: task.task_id,
      runId: task.run_id,
      stepTitle: task.step_title,
      stepDescription: task.step_description,
      scope: task.scope,
      ownerRole: task.owner_role,
      workspacePath: task.workspace_path,
      targetPath: task.target_path,
      cli: cliConfig?.cli ?? 'claude',
      model: recommendedModel,
      timeout: cliConfig?.timeout ?? executionPolicy.budgets.per_task_time_seconds,
      acceptanceCriteria: task.acceptance_criteria,
      specification: task.specification,
      planContext: runDoc?.context as Record<string, unknown> | undefined,
      planUnderstanding: runDoc?.understanding as Record<string, unknown> | undefined,
      prepFindings,
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

    // Spawn agent with exit callback
    try {
      const onAgentExited = (info: AgentExitInfo) => {
        this.handleAgentExited(info, runId).catch(err => {
          console.error(`[Orchestrator] handleAgentExited failed for task ${info.taskId}:`, err);
        });
      };
      const result = await this.spawnTask(spawnOptions, onAgentExited);

      // Store agent ID
      this.storage.updateTask(task.task_id, { agent_id: result.agentId });

      // Track in local map
      const agentTracker: AgentTracker = {
        taskId: task.task_id,
        agentId: result.agentId,
        pid: result.pid,
        startTime: Date.now(),
        attemptNumber,
        model: recommendedModel,
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
   * Dispatches a sub-plan task by creating a child run.
   * Instead of spawning an agent, fetches the sub-plan from Planner,
   * creates a child Run, and starts its execution loop.
   */
  private async dispatchSubPlanTask(task: Task, parentRunId: string): Promise<void> {
    const subPlanId = task.sub_plan_id!;
    console.log(
      `[Orchestrator] Dispatching sub-plan task ${task.step_id} → sub-plan ${subPlanId}`
    );

    if (!this.plannerClient) {
      console.error(
        `[Orchestrator] Cannot dispatch sub-plan task: no PlannerClient configured`
      );
      this.storage.updateTaskStatus(task.task_id, TaskStatus.Failed);
      return;
    }

    // Transition task to running
    this.storage.updateTaskStatus(task.task_id, TaskStatus.Running);

    try {
      // Fetch the sub-plan from Planner
      const planVersion = await this.plannerClient.fetchPlanVersion(subPlanId);

      // Transform to ForgePlan
      const { plan: forgePlan, warnings } = transformToForgePlan(
        planVersion,
        this.forgeConfig ?? createDefaultConfig()
      );

      if (warnings.length > 0) {
        console.warn(
          `[Orchestrator] Sub-plan ${subPlanId} transform warnings:`,
          warnings.map((w) => w.message)
        );
      }

      // Create child run and tasks in a transaction
      const { childRun, childTasksCount } = this.storage.transaction(() => {
        const newRun = createRun(forgePlan, {
          workspacePath: task.workspace_path,
          parentRunId,
          parentTaskId: task.task_id,
        });
        this.storage.createRun(newRun);

        let count = 0;
        for (const step of forgePlan.steps) {
          const childTask = createTask(newRun.run_id, step, task.workspace_path);
          this.storage.createTask(childTask);
          count++;
        }

        return { childRun: newRun, childTasksCount: count };
      });

      // Link child run back to parent task
      this.storage.updateTask(task.task_id, { child_run_id: childRun.run_id });

      // Track the child run for completion monitoring
      this.childRunTrackers.set(task.task_id, {
        parentTaskId: task.task_id,
        parentRunId,
        childRunId: childRun.run_id,
        startTime: Date.now(),
      });

      console.log(
        `[Orchestrator] Created child run ${childRun.run_id} with ${childTasksCount} tasks for sub-plan ${subPlanId}`
      );

      // Start the child run execution (fire-and-forget via scheduleReadyTasks)
      this.scheduleReadyTasks(childRun.run_id);
    } catch (err) {
      console.error(
        `[Orchestrator] Failed to create child run for sub-plan ${subPlanId}:`,
        err
      );
      this.storage.updateTaskStatus(task.task_id, TaskStatus.Failed);

      const executionPolicy =
        this.storage.getRun(parentRunId)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;
      await this.runService.handleTaskFailure(
        task,
        parentRunId,
        1,
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
        // Release agent immediately - it's done, no need to wait for TASK_POST gate evaluation
        this.releaseAgentProcess(tracker.agentId);
        agentTrackers.delete(taskId);
        console.log(`[Orchestrator] Released agent ${tracker.agentId} for task ${task.step_id} (before TASK_POST)`);
        await this.handleTaskCompletion(task, runId, tracker);
      } else if (task.status === TaskStatus.Failed) {
        // Release agent immediately - failure handling doesn't need the worker alive
        this.releaseAgentProcess(tracker.agentId);
        agentTrackers.delete(taskId);
        console.log(`[Orchestrator] Released agent ${tracker.agentId} for task ${task.step_id} (before failure handling)`);
        await this.handleTaskFailure(task, runId, tracker);
      }
    }

    // Check child run completions for sub-plan tasks
    await this.checkChildRunCompletions(runId);
  }

  /**
   * Handles agent process exit detected by PID monitoring.
   *
   * If the task already reported (completed/failed/blocked via MCP), this is a no-op.
   * If the task is still 'running' (agent exited without calling report_complete),
   * check git log for a commit marker. If found, mark as completed. Otherwise mark as failed.
   *
   * This is the fallback path. The primary path is MCP self-reporting.
   */
  private async handleAgentExited(info: AgentExitInfo, runId: string): Promise<void> {
    const task = this.storage.getTask(info.taskId);
    if (!task) return;

    // If task already reported via MCP, nothing to do
    if (task.status !== TaskStatus.Running) {
      console.log(
        `[Orchestrator] Agent ${info.agentId} exited, task ${task.step_id} already ${task.status} (MCP reported)`
      );
      return;
    }

    // Agent exited while task is still 'running' — check git log for commit marker
    const workspacePath = task.workspace_path || this.runWorktrees.get(runId);
    if (workspacePath) {
      try {
        const taskIdPrefix = info.taskId.slice(0, 8);
        const { stdout } = await execFileAsync(
          'git',
          ['log', '--oneline', '--all', '--grep', `[forge:${taskIdPrefix}]`],
          { cwd: workspacePath }
        );

        if (stdout.trim()) {
          console.log(
            `[Orchestrator] Agent ${info.agentId} exited but found commit [forge:${taskIdPrefix}] — marking task ${task.step_id} as completed`
          );
          this.storage.updateTaskStatus(info.taskId, TaskStatus.Completed);
          const attempts = this.storage.listAttemptsByTask(info.taskId);
          if (attempts.length > 0) {
            const lastAttempt = attempts[attempts.length - 1]!;
            this.storage.updateAttempt(lastAttempt.attempt_id, {
              outcome: AttemptOutcome.Success,
            });
          }
          return;
        }
      } catch (err) {
        // Git check failed, fall through to mark as failed
        console.log(`[Orchestrator] Git commit check failed for task ${task.step_id}:`, err);
      }
    }

    // No commit found or git check failed — mark as failed
    console.log(
      `[Orchestrator] Agent ${info.agentId} exited without MCP report or commit marker — marking task ${task.step_id} as failed (crash or timeout)`
    );
    this.storage.updateTaskStatus(info.taskId, TaskStatus.Failed);

    // Record the error on the latest attempt
    const attempts = this.storage.listAttemptsByTask(info.taskId);
    if (attempts.length > 0) {
      const lastAttempt = attempts[attempts.length - 1]!;
      this.storage.updateAttempt(lastAttempt.attempt_id, {
        outcome: AttemptOutcome.Failure,
        error: 'Agent exited without reporting completion (crash or timeout)',
      });
    }
  }

  /**
   * Checks if any child runs (from sub_plan_id steps) have completed.
   * Propagates child run completion/failure to the parent task.
   */
  private async checkChildRunCompletions(parentRunId: string): Promise<void> {
    for (const [parentTaskId, tracker] of this.childRunTrackers.entries()) {
      if (tracker.parentRunId !== parentRunId) continue;

      const childRun = this.storage.getRun(tracker.childRunId);
      if (!childRun) continue;

      if (childRun.status === RunStatus.Completed) {
        console.log(
          `[Orchestrator] Child run ${tracker.childRunId} completed → marking parent task ${parentTaskId} as completed`
        );
        this.storage.updateTaskStatus(parentTaskId, TaskStatus.Completed);
        this.childRunTrackers.delete(parentTaskId);
      } else if (childRun.status === RunStatus.Failed) {
        console.error(
          `[Orchestrator] Child run ${tracker.childRunId} failed → marking parent task ${parentTaskId} as failed`
        );
        this.storage.updateTaskStatus(parentTaskId, TaskStatus.Failed);
        this.childRunTrackers.delete(parentTaskId);

        const executionPolicy =
          this.storage.getRun(parentRunId)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;
        const parentTask = this.storage.getTask(parentTaskId);
        if (parentTask) {
          await this.runService.handleTaskFailure(
            parentTask,
            parentRunId,
            1,
            childRun.error ?? 'Child run failed',
            executionPolicy
          );
        }
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

    // Safety net: auto-commit uncommitted changes left by agents that forgot
    await this.ensureWorkCommitted(task);

    const durationMs = Date.now() - tracker.startTime;

    // TODO: Parse real token usage from agent output/relay response
    // Currently agent output is not captured by forge-spawner, so metrics are unavailable
    const tokensUsed = 0; // Real token data not yet available from agents
    const costUsd = 0; // Real cost data not yet available from agents
    const confidence = 0.95;

    // Validate with RunService
    const result = this.runService.handleTaskCompletion(task, runId, confidence, {
      tokens: tokensUsed,
      cost: costUsd,
      duration_ms: durationMs,
      model_id: tracker.model,
    });

    if (!result.accepted) {
      console.warn(
        `[Orchestrator] Task ${task.step_id} completion rejected: ${result.message}`
      );
      // Confidence handler may have already marked for retry/escalation
      return;
    }

    // TASK_POST verification gate
    const executionPolicy = this.storage.getRun(runId)?.execution_policy ?? DEFAULT_EXECUTION_POLICY;
    const qualityConfig: QualityConfig = (executionPolicy as any).quality ?? {};
    let taskPostResult: TaskPostResult | undefined;

    if (this.hasQualityGateMechanism && qualityConfig.task_post_enabled !== false) {
      taskPostResult = await this.runTaskPost(task, runId, qualityConfig);

      if (taskPostResult && !taskPostResult.passed) {
        console.warn(
          `[Orchestrator] TASK_POST failed for ${task.step_id}: ${taskPostResult.reason}`
        );

        // Store failure context in task specification for retry worker
        const failureContext = {
          failure_reason: taskPostResult.reason,
          severity: taskPostResult.severity ?? 'fix_issues',
          findings: taskPostResult.findings,
          attempt: tracker.attemptNumber,
        };

        const existingSpec = task.specification ?? {};
        this.storage.updateTask(task.task_id, {
          status: TaskStatus.Failed,
          specification: {
            ...existingSpec,
            retry_context: failureContext,
          },
        });

        await this.runService.handleTaskFailure(
          task,
          runId,
          tracker.attemptNumber,
          `TASK_POST failed: ${taskPostResult.reason}`,
          executionPolicy
        );
        return; // Don't complete — retry will pick it up
      }

      // Store findings in run document for future PREP phases
      if (taskPostResult) {
        this.accumulateRunDoc(runId, `post_${task.step_id}`, taskPostResult.findings);
      }
    }

    // Record artifacts
    await this.runService.recordTaskArtifacts(task, runId);

    // Emit outcome to tuner
    const outcome: TaskOutcomeEmission = {
      run_id: runId,
      task_id: task.task_id,
      step_id: task.step_id,
      model_used: tracker.model,
      complexity_estimate: estimateComplexityLevel(task),
      outcome: 'success',
      attempts: tracker.attemptNumber,
      duration_seconds: durationMs / 1000,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      confidence_score: confidence,
      verification: taskPostResult?.verification,
      ac_results: taskPostResult?.ac_results,
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

    // Get actual error message from the latest attempt
    const attempts = this.storage.listAttemptsByTask(task.task_id);
    const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    const errorMessage = latestAttempt?.error || tracker.errorMessage || 'Task execution failed';

    // Let RunService apply recovery ladder
    await this.runService.handleTaskFailure(
      task,
      runId,
      tracker.attemptNumber,
      errorMessage,
      executionPolicy
    );

    // Emit failure outcome to tuner
    const outcome: TaskOutcomeEmission = {
      run_id: runId,
      task_id: task.task_id,
      step_id: task.step_id,
      model_used: tracker.model,
      complexity_estimate: estimateComplexityLevel(task),
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

    // RUN_POST: cross-scope integration review (advisory, doesn't block completion)
    const executionPolicy = run.execution_policy ?? DEFAULT_EXECUTION_POLICY;
    const qualityConfig: QualityConfig = (executionPolicy as any).quality ?? {};
    let runPostResult: Record<string, unknown> | undefined;

    if (this.hasQualityGateMechanism && qualityConfig.run_post_enabled !== false) {
      runPostResult = await this.runRunPost(runId, qualityConfig);
      if (runPostResult) {
        this.accumulateRunDoc(runId, 'run_post', runPostResult);
        const warnings = runPostResult.warnings as string[] | undefined;
        if (warnings && warnings.length > 0) {
          console.warn(`[Orchestrator] RUN_POST warnings for ${runId}:`, warnings);
        }
      }
    }

    // AC AUDIT: feature-level acceptance criteria verification (advisory, non-blocking)
    let acAuditResult: Record<string, unknown> | undefined;
    if (this.hasQualityGateMechanism && qualityConfig.run_post_ac_audit !== false) {
      acAuditResult = await this.runRunAcAudit(runId, qualityConfig);
      if (acAuditResult) {
        this.accumulateRunDoc(runId, 'ac_audit', acAuditResult);
        const unmetCount = (acAuditResult.unmet_criteria as string[] | undefined)?.length ?? 0;
        if (unmetCount > 0) {
          console.warn(`[Orchestrator] AC audit for ${runId}: ${unmetCount} unmet criteria`);
        }
      }
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
      verification_summary: runPostResult?.verification_summary as RunOutcomeEmission['verification_summary'],
      timestamp: new Date().toISOString(),
      source: 'production',
    };

    await this.runService.emitRunOutcome(outcome);

    // Check for uncommitted work in the worktree before declaring done
    const worktreePath = this.runWorktrees.get(runId);
    if (worktreePath && existsSync(worktreePath) && worktreePath.includes('.forge-worktrees/')) {
      try {
        const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: worktreePath });
        if (status.trim()) {
          console.warn(
            `[Orchestrator] Run ${runId} has uncommitted changes at finalization — auto-committing`
          );
          await execFileAsync('git', ['add', '.'], { cwd: worktreePath });
          await execFileAsync('git', [
            'commit', '-m',
            `[forge:${runId}] Finalization: uncommitted work`,
          ], { cwd: worktreePath });
        }
      } catch (err) {
        console.warn(
          `[Orchestrator] Run ${runId} finalization git check failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Merge worktree commits back to the base branch, then clean up.
    if (worktreePath && this.worktreeManager) {
      await this.mergeWorktreeCommits(runId, worktreePath);
    }
    this.runWorktrees.delete(runId);

    // Clear timeout tracking for this run
    const timeoutManager = this.runService.getTaskTimeoutManager();
    for (const task of allTasks) {
      timeoutManager.untrackTask(task.task_id);
    }

    // Terminate any remaining agents (safety net — most should be released per-task)
    this.terminateRunAgents(runId);
    this.runTierMaps.delete(runId);

    // Remove from build registry
    for (const [buildId, runIds] of this.buildRunRegistry) {
      runIds.delete(runId);
      if (runIds.size === 0) this.buildRunRegistry.delete(buildId);
    }
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

    // Clean up worktree
    this.cleanupWorktree(runId).catch((err) => {
      console.warn(`[Orchestrator] Failed to cleanup worktree for run ${runId}:`, err);
    });

    // Clear timeout tracking for this run
    const timeoutManager = this.runService.getTaskTimeoutManager();
    for (const task of allTasks) {
      timeoutManager.untrackTask(task.task_id);
    }

    // Terminate any remaining agents (safety net)
    this.terminateRunAgents(runId);
    this.runTierMaps.delete(runId);

    // Remove from build registry
    for (const [buildId, runIds] of this.buildRunRegistry) {
      runIds.delete(runId);
      if (runIds.size === 0) this.buildRunRegistry.delete(buildId);
    }
  }

  // ============================================
  // Quality Gates: PREP / TASK_POST / RUN_POST
  // ============================================

  /**
   * Runs PREP analysis at a tier boundary.
   * Groups ready tasks by scope and runs analysis for each scope group.
   */
  private async runPrepPhase(
    runId: string,
    readyTasks: Task[],
    currentTier: number,
    tierMap: Map<string, number>,
    qualityConfig: QualityConfig
  ): Promise<void> {
    const run = this.storage.getRun(runId);
    if (!run) return;

    // Group ready tasks by scope
    const scopeGroups = new Map<string, Task[]>();
    for (const task of readyTasks) {
      const scope = task.scope ?? 'default';
      const group = scopeGroups.get(scope);
      if (group) {
        group.push(task);
      } else {
        scopeGroups.set(scope, [task]);
      }
    }

    const maxTier = Math.max(...tierMap.values(), 0);
    const runDoc = this.storage.getRunDocument(runId);
    const workspacePath = run.workspace_path;

    for (const [scope, tasks] of scopeGroups) {
      console.log(
        `[Orchestrator] Running PREP for scope=${scope} tier=${currentTier} (${tasks.length} tasks)`
      );

      const prompt = this.buildPrepPrompt(
        scope, currentTier, maxTier, tasks, runDoc, workspacePath
      );

      try {
        const result = await this.runQualityGate(prompt, {
          model: qualityConfig.prep_model ?? 'sonnet',
          cwd: workspacePath,
          timeoutMs: qualityConfig.prep_timeout_ms ?? 90000,
          retries: 0, // No retries — PREP is non-blocking, don't waste time
        });

        const findings = result.parsed ?? { raw: result.output };
        this.accumulateRunDoc(runId, `prep_${scope}_tier${currentTier}`, findings);

        const usageInfo = result.usage
          ? ` | ${result.usage.input_tokens}in/${result.usage.output_tokens}out tokens, $${result.usage.total_cost_usd.toFixed(4)}`
          : '';
        console.log(
          `[Orchestrator] PREP complete for scope=${scope} tier=${currentTier} (${result.durationMs}ms${usageInfo})`
        );
      } catch (err) {
        console.error(
          `[Orchestrator] PREP failed for scope=${scope} tier=${currentTier}:`,
          err
        );
        // Don't block execution if PREP fails — continue without analysis
      }
    }
  }

  /**
   * Runs TASK_POST verification after task completion.
   * Returns pass/fail with findings for run document accumulation.
   */
  private async runTaskPost(
    task: Task,
    runId: string,
    qualityConfig: QualityConfig
  ): Promise<TaskPostResult | undefined> {
    const run = this.storage.getRun(runId);
    if (!run) return undefined;

    const workspacePath = run.workspace_path;
    const runDoc = this.storage.getRunDocument(runId);

    // Get PREP guidance for this task
    const tierMap = this.runTierMaps.get(runId);
    const tier = tierMap?.get(task.step_id) ?? 0;
    const prepKey = `prep_${task.scope ?? 'default'}_tier${tier}`;
    const prepFindings = runDoc?.[prepKey] as Record<string, unknown> | undefined;

    console.log(`[Orchestrator] Running TASK_POST for ${task.step_id}`);

    // Find task-specific commits — collect stat only (file list), not full diff.
    // The CLI has file-reading tools and can inspect files as needed.
    let fileStat: string | undefined;
    if (workspacePath) {
      const commits = await this.findTaskCommits(workspacePath, task.task_id);
      if (commits.length > 0) {
        console.log(
          `[Orchestrator] TASK_POST found ${commits.length} commit(s) for ${task.step_id}`
        );
        const diff = await this.collectCommitDiff(workspacePath, commits);
        fileStat = diff?.stat;
      } else {
        console.warn(
          `[Orchestrator] TASK_POST: no commits found for ${task.step_id}, falling back to workspace stat`
        );
        const diff = await this.collectGitDiff(workspacePath);
        fileStat = diff?.stat;
      }
    }

    const prompt = this.buildTaskPostPrompt(task, prepFindings, workspacePath, fileStat);

    try {
      const result = await this.runQualityGate(prompt, {
        model: qualityConfig.task_post_model ?? 'haiku',
        cwd: workspacePath,
        timeoutMs: qualityConfig.task_post_timeout_ms ?? 120000,
      });

      const parsed = result.parsed;
      if (!parsed) {
        console.warn(
          `[Orchestrator] TASK_POST returned non-JSON for ${task.step_id}, treating as pass`
        );
        return { passed: true, findings: { raw: result.output } };
      }

      const passed = parsed.passed !== false; // Default to pass if ambiguous
      const reason = parsed.reason as string | undefined;

      const usageInfo = result.usage
        ? ` | ${result.usage.input_tokens}in/${result.usage.output_tokens}out tokens, $${result.usage.total_cost_usd.toFixed(4)}`
        : '';
      // Log scope violations as warnings
      const scopeViolations = parsed.scope_violations as string[] | undefined;
      if (scopeViolations && scopeViolations.length > 0) {
        console.warn(
          `[Orchestrator] TASK_POST scope violations for ${task.step_id}: ${scopeViolations.join(', ')}`
        );
      }

      console.log(
        `[Orchestrator] TASK_POST for ${task.step_id}: ${passed ? 'PASSED' : 'FAILED'}${reason ? ` — ${reason}` : ''} (${result.durationMs}ms${usageInfo})`
      );

      return {
        passed,
        reason,
        findings: parsed,
        verification: parsed.verification as TaskPostResult['verification'],
        // Accept both old (criteria_results) and new (ac_status) field names
        ac_results: (parsed.criteria_results ?? parsed.ac_status) as TaskPostResult['ac_results'],
      };
    } catch (err) {
      console.error(`[Orchestrator] TASK_POST failed for ${task.step_id}:`, err);
      // Don't block on TASK_POST errors — treat as pass
      return { passed: true, findings: { error: String(err) } };
    }
  }

  /**
   * Runs RUN_POST integration review after all tasks complete.
   * Advisory only — returns findings but doesn't block.
   */
  private async runRunPost(
    runId: string,
    qualityConfig: QualityConfig
  ): Promise<Record<string, unknown> | undefined> {
    const run = this.storage.getRun(runId);
    if (!run) return undefined;

    const workspacePath = run.workspace_path;
    const allTasks = this.storage.listTasksByRun(runId);
    const runDoc = this.storage.getRunDocument(runId);
    const tierMap = this.runTierMaps.get(runId);

    console.log(`[Orchestrator] Running RUN_POST for run ${runId}`);

    // Collect file stat for run review — stat only, CLI can read files as needed.
    if (workspacePath) {
      await execFileAsync('git', ['add', '-N', '.'], { cwd: workspacePath }).catch(() => {});
    }
    const gitDiff = await this.collectGitDiff(workspacePath);
    const fileStat = gitDiff?.stat;

    const prompt = this.buildRunPostPrompt(run, allTasks, runDoc, tierMap, workspacePath, fileStat);

    try {
      const result = await this.runQualityGate(prompt, {
        model: qualityConfig.run_post_model ?? 'haiku',
        cwd: workspacePath,
        timeoutMs: 300000, // 5 min — accounts for relay spawn overhead
      });

      const parsed = result.parsed ?? { raw: result.output };

      const usageInfo = result.usage
        ? ` | ${result.usage.input_tokens}in/${result.usage.output_tokens}out tokens, $${result.usage.total_cost_usd.toFixed(4)}`
        : '';
      console.log(
        `[Orchestrator] RUN_POST complete for run ${runId} (${result.durationMs}ms${usageInfo})`
      );

      return parsed;
    } catch (err) {
      console.error(`[Orchestrator] RUN_POST failed for run ${runId}:`, err);
      return undefined;
    }
  }

  private async runRunAcAudit(
    runId: string,
    qualityConfig: QualityConfig,
  ): Promise<Record<string, unknown> | undefined> {
    const run = this.storage.getRun(runId);
    if (!run) return undefined;

    const workspacePath = run.workspace_path;
    const allTasks = this.storage.listTasksByRun(runId);
    const runDoc = this.storage.getRunDocument(runId);

    console.log(`[Orchestrator] Running AC audit for run ${runId}`);

    // Collect file stat for AC audit — stat only, CLI can read files as needed.
    if (workspacePath) {
      await execFileAsync('git', ['add', '-N', '.'], { cwd: workspacePath }).catch(() => {});
    }
    const gitDiff = await this.collectGitDiff(workspacePath);
    const fileStat = gitDiff?.stat;

    const prompt = this.buildRunAcAuditPrompt(run, allTasks, runDoc, workspacePath, fileStat);

    try {
      const result = await this.runQualityGate(prompt, {
        model: qualityConfig.run_post_ac_model ?? 'sonnet',
        cwd: workspacePath,
        timeoutMs: qualityConfig.run_post_ac_timeout_ms ?? 300000,
      });

      const parsed = result.parsed ?? { raw: result.output };

      const usageInfo = result.usage
        ? ` | ${result.usage.input_tokens}in/${result.usage.output_tokens}out tokens, $${result.usage.total_cost_usd.toFixed(4)}`
        : '';
      console.log(
        `[Orchestrator] AC audit complete for run ${runId} (${result.durationMs}ms${usageInfo})`
      );

      return parsed;
    } catch (err) {
      console.error(`[Orchestrator] AC audit failed for run ${runId}:`, err);
      return undefined;
    }
  }

  /**
   * Merges a keyed value into the existing run document.
   */
  private accumulateRunDoc(runId: string, key: string, value: unknown): void {
    const existing = this.storage.getRunDocument(runId) ?? {};
    existing[key] = value;
    this.storage.setRunDocument(runId, existing);
  }

  /**
   * Finds commits made by an agent for a specific task.
   * Agents are instructed to use [forge:{taskId}] in commit messages.
   */
  private async findTaskCommits(
    workspacePath: string,
    taskId: string
  ): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', '--all', '--format=%H', '--fixed-strings', `--grep=[forge:${taskId}]`],
        { cwd: workspacePath }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Collects git diff from specific commits (per-task isolation).
   * Uses `git show` to get the exact changes in each commit.
   */
  private async collectCommitDiff(
    workspacePath: string,
    commitShas: string[]
  ): Promise<{ stat: string; diff: string } | undefined> {
    if (commitShas.length === 0) return undefined;

    try {
      let combinedStat = '';
      let combinedDiff = '';

      for (const sha of commitShas) {
        const { stdout: stat } = await execFileAsync(
          'git',
          ['show', '--stat', '--format=', sha],
          { cwd: workspacePath, maxBuffer: 1024 * 1024 }
        );
        const { stdout: diff } = await execFileAsync(
          'git',
          ['show', '--format=', sha],
          { cwd: workspacePath, maxBuffer: 5 * 1024 * 1024 }
        );
        combinedStat += stat;
        combinedDiff += diff;
      }

      // Cap diff to prevent context overflow
      const diffLines = combinedDiff.split('\n');
      const cappedDiff =
        diffLines.length > 800
          ? diffLines.slice(0, 800).join('\n') +
            `\n\n... (truncated, ${diffLines.length - 800} more lines)`
          : combinedDiff;

      return { stat: combinedStat.trim(), diff: cappedDiff.trim() };
    } catch (err) {
      console.warn('[Orchestrator] Failed to collect commit diff:', err);
      return undefined;
    }
  }

  /**
   * Collects git diff from the workspace, scoped to specific path filters.
   * Includes both tracked changes and new untracked files.
   * Returns stat summary and diff content (capped to avoid context overflow).
   */
  private async collectGitDiff(
    workspacePath?: string,
    pathFilters?: string[]
  ): Promise<{ stat: string; diff: string } | undefined> {
    if (!workspacePath) return undefined;

    const pathArgs = pathFilters && pathFilters.length > 0 ? ['--', ...pathFilters] : [];

    try {
      // Stage new files so they show up in git diff
      // Use -N (intent to add) so we don't actually stage content
      if (pathFilters && pathFilters.length > 0) {
        await execFileAsync(
          'git',
          ['add', '-N', ...pathFilters],
          { cwd: workspacePath }
        ).catch(() => {}); // Ignore errors (paths may not exist yet)
      }

      // Get diff stat (summary of changes)
      const { stdout: stat } = await execFileAsync(
        'git',
        ['diff', '--stat', 'HEAD', ...pathArgs],
        { cwd: workspacePath, maxBuffer: 1024 * 1024 }
      );

      // Get actual diff content
      const { stdout: fullDiff } = await execFileAsync(
        'git',
        ['diff', 'HEAD', ...pathArgs],
        { cwd: workspacePath, maxBuffer: 5 * 1024 * 1024 }
      );

      const diffLines = fullDiff.split('\n');
      const cappedDiff =
        diffLines.length > 800
          ? diffLines.slice(0, 800).join('\n') +
            `\n\n... (truncated, ${diffLines.length - 800} more lines)`
          : fullDiff;

      return { stat: stat.trim(), diff: cappedDiff.trim() };
    } catch (err) {
      console.warn(`[Orchestrator] Failed to collect git diff:`, err);
      return undefined;
    }
  }

  // ============================================
  // Prompt Builders
  // ============================================

  private buildPrepPrompt(
    scope: string,
    tier: number,
    totalTiers: number,
    tasks: Task[],
    runDoc: Record<string, unknown> | null,
    workspacePath?: string
  ): string {
    let prompt = `You are a PREP analyst setting context for implementation agents.

Your analysis is THE MOST IMPORTANT input agents receive — it directly prevents scope drift,
conflicting patterns, and wasted work. Be thorough but efficient.

## Scope: ${scope} | Tier: ${tier}/${totalTiers}
${workspacePath ? `## Workspace: ${workspacePath}` : ''}
`;

    // Add previous tier results if not tier 0
    if (tier > 0 && runDoc) {
      const prevTierKeys = Object.keys(runDoc).filter(
        (k) => k.startsWith(`post_`) || k.startsWith(`prep_${scope}_tier${tier - 1}`)
      );
      if (prevTierKeys.length > 0) {
        prompt += `\n## Previous Tier Results\n\n`;
        for (const key of prevTierKeys) {
          if (key.startsWith('post_')) {
            const findings = runDoc[key] as Record<string, unknown>;
            const passed = findings?.passed !== false ? 'PASSED' : 'FAILED';
            prompt += `- **${key.replace('post_', '')}**: ${passed}\n`;
            if (findings?.issues) {
              prompt += `  Issues: ${JSON.stringify(findings.issues)}\n`;
            }
          }
        }
        prompt += `\nReview the previous tier's work before analyzing upcoming tasks.\n`;
      }
    }

    // Add upcoming tasks
    prompt += `\n## Upcoming Tasks\n\n`;
    for (const task of tasks) {
      prompt += `### ${task.step_title} (${task.step_id})\n`;
      if (task.step_description) {
        prompt += `${task.step_description}\n`;
      }
      if (task.owner_role) {
        prompt += `- Role: ${task.owner_role}\n`;
      }
      if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
        prompt += `- Acceptance Criteria:\n`;
        for (const ac of task.acceptance_criteria) {
          prompt += `  - [${ac.id}] ${ac.description}${ac.type ? ` (${ac.type})` : ''}\n`;
        }
      }
      if (task.specification) {
        const spec = task.specification as Record<string, unknown>;
        if (spec.verify_only) {
          prompt += `- **VERIFY ONLY** — code exists from a previous completed build. Verify quality, don't rebuild.\n`;
        } else if (spec.already_built_hint) {
          prompt += `- *Note:* Similar task was completed in a prior build. Check if code already exists before implementing.\n`;
        }
        // Show spec without the meta-flags
        const { verify_only, already_built_hint, prior_run_id, ...cleanSpec } = spec;
        if (Object.keys(cleanSpec).length > 0) {
          prompt += `- Specification:\n\`\`\`json\n${JSON.stringify(cleanSpec, null, 2)}\n\`\`\`\n`;
        }
      }
      prompt += `\n`;
    }

    // Add plan context if available
    if (runDoc?.context) {
      prompt += `## Architecture Context\n\`\`\`json\n${JSON.stringify(runDoc.context, null, 2)}\n\`\`\`\n\n`;
    }

    // Inject compact directory summary if workspace exists
    const scopeStructure = this.mapScopeDirectories(scope, workspacePath);
    if (scopeStructure) {
      prompt += `## Scope Structure\n\n\`\`\`\n${scopeStructure}\`\`\`\n\n`;
    }

    prompt += `## How to Analyze

Use efficient codebase exploration tools — DO NOT read entire files line by line.

1. **Map the scope**: ${scopeStructure ? 'Use the Scope Structure above as your starting reference. ' : ''}Use Glob to find relevant files. Read file outlines (not full content) to understand structure.
2. **Find existing patterns**: Search for similar implementations (e.g., existing routes, storage methods, domain types). Agents MUST follow these patterns.
3. **Identify shared files**: Which files will multiple tasks touch? Flag merge conflict risks.
4. **Define scope boundaries**: List which directories/files belong to this scope. Agents must NOT modify files outside their scope.
5. **Produce per-task guidance**: Specific files to modify, patterns to follow, pitfalls to avoid.

## Output

CRITICAL: Output ONLY a raw JSON object. No markdown, no explanation, no code blocks.

{
  "scope_analysis": "Current state of this scope — what exists, what's missing",
  "scope_boundary": {
    "owned_paths": ["directories and files this scope owns"],
    "do_not_touch": ["paths agents must NOT modify"]
  },
  "existing_patterns": {
    "pattern_name": "Description of the pattern and where to find it"
  },
  "shared_files": ["files multiple tasks will touch — coordinate carefully"],
  "conflicts": ["potential conflicts between tasks"],
  "task_guidance": {
    "<step_id>": {
      "files_to_modify": ["specific files this task should create or edit"],
      "patterns_to_follow": "Which existing pattern to match and where to find the reference",
      "watch_out": "Specific pitfalls — wrong imports, missing exports, naming conventions",
      "guidance": "Concise implementation approach",
      "already_implemented": false,
      "existing_files": []
    }
  },
  "warnings": ["anything that could cause problems across tasks"]
}`;

    return prompt;
  }

  /**
   * Returns a compact directory summary for a scope's src/ directory.
   * Format: "  dir/  (N files)" per subdirectory, ~15 lines max.
   */
  private mapScopeDirectories(scope: string, workspacePath?: string): string {
    if (!workspacePath) return '';

    const srcDir = join(workspacePath, 'packages', scope, 'src');
    try {
      statSync(srcDir);
    } catch {
      return '';
    }

    const dirCounts = new Map<string, number>();
    const rootFiles: string[] = [];

    const walk = (dir: string) => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
          const rel = relative(srcDir, dir);
          if (rel === '') {
            rootFiles.push(entry.name);
          } else {
            dirCounts.set(rel, (dirCounts.get(rel) ?? 0) + 1);
          }
        }
      }
    };

    walk(srcDir);

    if (dirCounts.size === 0 && rootFiles.length === 0) return '';

    const lines: string[] = [`packages/${scope}/src/`];
    // Sort directories alphabetically
    const sortedDirs = [...dirCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [dir, count] of sortedDirs) {
      lines.push(`  ${dir}/  (${count} files)`);
    }
    if (rootFiles.length > 0) {
      const fileList = rootFiles.length <= 6
        ? rootFiles.join(', ')
        : `${rootFiles.slice(0, 5).join(', ')}, +${rootFiles.length - 5} more`;
      lines.push(`  [root]  (${rootFiles.length} files: ${fileList})`);
    }
    return lines.join('\n') + '\n';
  }

  private buildTaskPostPrompt(
    task: Task,
    prepGuidance: Record<string, unknown> | undefined,
    workspacePath?: string,
    fileStat?: string
  ): string {
    let prompt = `Quick code review for a completed task. Review like a senior dev doing a fast PR check.

## Task: ${task.step_title}
- Scope: ${task.scope ?? 'default'}
${task.step_description ? `- Description: ${task.step_description}` : ''}
`;

    // Add acceptance criteria (compact)
    if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
      prompt += `\n## Acceptance Criteria\n`;
      for (const ac of task.acceptance_criteria) {
        prompt += `- [${ac.id}] ${ac.description}\n`;
      }
    }

    // Add PREP guidance — scope boundaries help catch drift
    if (prepGuidance) {
      const taskGuidance = (prepGuidance as any)?.task_guidance?.[task.step_id];
      if (taskGuidance) {
        prompt += `\n## PREP Analysis Context

The PREP agent analyzed the codebase before this worker was dispatched and provided the following guidance:

\`\`\`json
${JSON.stringify(taskGuidance, null, 2)}
\`\`\`

**IMPORTANT**: If the worker followed PREP's recommendations (especially the \`guidance\`, \`patterns_to_follow\`, and \`watch_out\` fields), this should be evaluated as CORRECT behavior — even if the implementation differs from the literal acceptance criteria text. The worker was given these constraints by PREP and is expected to follow them.

Only flag as a failure if the worker deviated from BOTH the acceptance criteria AND the PREP guidance without good reason.
`;
      }
      const scopeBoundary = (prepGuidance as any)?.scope_boundary;
      if (scopeBoundary?.do_not_touch) {
        prompt += `\n## Scope Boundary — files that should NOT be modified:\n${(scopeBoundary.do_not_touch as string[]).map((f: string) => `- ${f}`).join('\n')}\n`;
      }
    }

    if (fileStat) {
      prompt += `\n## Files Changed\n\`\`\`\n${fileStat}\n\`\`\`\n`;
    }

    if (workspacePath) {
      prompt += `\nWorkspace: ${workspacePath}\n`;
    }

    prompt += `
## Review Checklist (be fast — this is a quarter review)

1. Scan changed files — do they make sense for this task?
2. Spot-check: obvious bugs, type errors, missing exports/imports
3. Verify ACs are met (brief check, not exhaustive evidence gathering)
4. Flag if files outside this task's scope were modified

DO NOT read every file top-to-bottom. Use targeted searches: search for function names, type definitions, exports.
Keep this fast — 60 seconds is the target.

## Severity Classification (for failures)

If you mark passed: false, classify the failure severity:

- **fix_issues**: The commit is mostly correct but has specific problems. The retry worker should fix on top of the existing commit (small fixes, missing edge cases, minor bugs).
- **clean_restart**: The commit is fundamentally wrong. The retry worker should start fresh with a different approach (the previous commit will be reverted).

CRITICAL: Output ONLY a raw JSON object. No markdown, no code blocks.

{
  "passed": true,
  "reason": "One sentence if failed",
  "severity": "fix_issues|clean_restart (required if passed=false)",
  "ac_status": [{ "id": "ac_id", "met": true }],
  "issues": ["real bugs or missing functionality only"],
  "scope_violations": ["files modified outside expected scope, if any"],
  "warnings": ["non-blocking concerns"]
}`;

    return prompt;
  }

  private buildRunPostPrompt(
    run: Run,
    allTasks: Task[],
    runDoc: Record<string, unknown> | null,
    tierMap: Map<string, number> | undefined,
    workspacePath?: string,
    fileStat?: string
  ): string {
    const completedTasks = allTasks.filter((t) => t.status === TaskStatus.Completed);
    const failedTasks = allTasks.filter((t) => t.status === TaskStatus.Failed);
    const tierCount = tierMap ? Math.max(...tierMap.values(), 0) + 1 : 1;

    let prompt = `PR-level review of a completed run. You are reviewing the combined output of ${completedTasks.length} tasks as one coherent changeset.

## Run: ${run.plan_id} v${run.plan_version}
- Tasks: ${completedTasks.length} completed${failedTasks.length > 0 ? `, ${failedTasks.length} failed` : ''}, ${tierCount} tier${tierCount > 1 ? 's' : ''}
${workspacePath ? `- Workspace: ${workspacePath}` : ''}

## Tasks Completed
`;

    for (const task of completedTasks) {
      const tier = tierMap?.get(task.step_id) ?? 0;
      const postKey = `post_${task.step_id}`;
      const postFindings = runDoc?.[postKey] as Record<string, unknown> | undefined;
      const postResult = postFindings?.passed !== false ? 'OK' : 'ISSUES';

      prompt += `- [T${tier}] [${task.scope ?? 'default'}] ${task.step_title} — ${postResult}`;
      if (postFindings?.issues && (postFindings.issues as unknown[]).length > 0) {
        prompt += ` (${(postFindings.issues as unknown[]).length} issues)`;
      }
      prompt += `\n`;
    }

    if (failedTasks.length > 0) {
      prompt += `\n## Failed Tasks\n`;
      for (const task of failedTasks) {
        prompt += `- [${task.scope ?? 'default'}] ${task.step_title}\n`;
      }
    }

    if (fileStat) {
      prompt += `\n## All Files Changed\n\`\`\`\n${fileStat}\n\`\`\`\n`;
    }

    prompt += `
## Review Focus (half review — integration, not individual task re-check)

1. **Cross-task integration**: Do exports from one task match imports in another? Search for shared type names and verify consistency.
2. **Pattern consistency**: Did different tasks use different patterns for the same thing? (e.g., different error handling, different naming conventions)
3. **Missing connections**: Are there TODO/FIXME markers, dead imports, or unresolved references?
4. **Type safety**: Run a mental type check — do interfaces align across files?

DO NOT re-verify individual acceptance criteria (TASK_POST already did that).
Use targeted file reads — search for specific symbols, don't read entire files.

CRITICAL: Output ONLY a raw JSON object. No markdown, no code blocks.

{
  "quality": "good|acceptable|needs_work",
  "summary": "2-3 sentence assessment",
  "integration_issues": ["cross-task problems found"],
  "inconsistencies": ["pattern mismatches"],
  "missing_connections": ["unresolved references or dead code"],
  "suggestions": ["concrete improvements"]
}`;

    return prompt;
  }

  private buildRunAcAuditPrompt(
    run: Run,
    allTasks: Task[],
    runDoc: Record<string, unknown> | null,
    workspacePath?: string,
    fileStat?: string,
  ): string {
    const completedTasks = allTasks.filter((t) => t.status === TaskStatus.Completed);
    const summary = runDoc?.summary as { goal: string; context?: string } | undefined;
    const featureGoal = summary?.goal ?? 'No goal specified';
    const featureContext = summary?.context;

    let prompt = `Feature-level acceptance criteria audit for a completed run. Verify that the feature goal was actually achieved by checking each acceptance criterion against the real code.

## Feature Goal
${featureGoal}
${featureContext ? `\nContext: ${featureContext}` : ''}

## Run: ${run.plan_id} v${run.plan_version}
- Tasks: ${completedTasks.length} completed
${workspacePath ? `- Workspace: ${workspacePath}` : ''}

## Tasks and Acceptance Criteria
`;

    for (const task of completedTasks) {
      prompt += `\n### Step: ${task.step_title} (${task.step_id})\n`;
      if (task.step_description) {
        prompt += `Description: ${task.step_description}\n`;
      }

      const postKey = `post_${task.step_id}`;
      const postFindings = runDoc?.[postKey] as Record<string, unknown> | undefined;
      if (postFindings) {
        prompt += `TASK_POST result: ${postFindings.passed !== false ? 'PASSED' : 'FAILED'}\n`;
        if (postFindings.issues && (postFindings.issues as unknown[]).length > 0) {
          prompt += `TASK_POST issues: ${JSON.stringify(postFindings.issues)}\n`;
        }
      }

      if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
        prompt += `Acceptance criteria:\n`;
        for (const ac of task.acceptance_criteria) {
          prompt += `  - [${ac.id}] ${ac.description}${ac.type ? ` (type: ${ac.type})` : ''}\n`;
        }
      } else {
        prompt += `No acceptance criteria defined for this step.\n`;
      }
    }

    if (fileStat) {
      prompt += `\n## All Files Changed\n\`\`\`\n${fileStat}\n\`\`\`\n`;
    }

    prompt += `
## Verification Instructions

Your job is to verify whether EACH acceptance criterion was actually met in the code. Do NOT just trust TASK_POST results — independently verify by reading the actual code.

1. **For each AC**: Use targeted file reads to check if the criterion is satisfied
2. **Be specific**: Provide file:line evidence or concrete function/variable names
3. **Check integration**: Does the feature work as a whole across all tasks?
4. **Identify gaps**: Are there feature-level requirements not covered by any AC?
5. **Suggest remediation**: For unmet criteria or gaps, what specific changes would close them?

CRITICAL: Output ONLY a raw JSON object. No markdown, no code blocks.

{
  "feature_goal_met": true|false,
  "goal_assessment": "2-3 sentence assessment of overall feature completion",
  "ac_results": [
    { "step_id": "...", "criterion_id": "...", "met": true|false, "evidence": "file:line or description" }
  ],
  "unmet_criteria": ["criterion_ids that were not met"],
  "gaps": ["feature-level gaps not covered by any AC"],
  "remediation_suggestions": ["what would close each gap"]
}`;

    return prompt;
  }

  /**
   * Merges forge commits from a worktree back to the current branch.
   * Worktrees use detached HEAD, so commits would be orphaned without this.
   * Cherry-picks [forge:*] commits in order, then removes the worktree.
   */
  private async mergeWorktreeCommits(runId: string, worktreePath: string): Promise<void> {
    try {
      // Get the worktree HEAD
      const { stdout: worktreeHead } = await execFileAsync(
        'git', ['rev-parse', 'HEAD'], { cwd: worktreePath }
      );
      const worktreeHeadHash = worktreeHead.trim();

      // Get the current branch HEAD from the main repo
      const repoRoot = this.worktreeManager!.root;
      const { stdout: branchHead } = await execFileAsync(
        'git', ['rev-parse', 'HEAD'], { cwd: repoRoot }
      );
      const branchHeadHash = branchHead.trim();

      if (worktreeHeadHash === branchHeadHash) {
        console.log(`[Orchestrator] Run ${runId}: worktree HEAD matches branch HEAD, no commits to merge`);
      } else {
        // Find forge commits on worktree that aren't on the branch
        const { stdout: commitList } = await execFileAsync(
          'git', [
            'log', '--oneline', '--reverse',
            '--fixed-strings', '--grep=[forge:',
            `${branchHeadHash}..${worktreeHeadHash}`,
          ],
          { cwd: worktreePath }
        );

        const commits = commitList.trim().split('\n').filter(Boolean);

        if (commits.length > 0) {
          const commitHashes = commits.map(line => line.split(' ')[0]!);
          console.log(
            `[Orchestrator] Run ${runId}: merging ${commitHashes.length} forge commits to branch`
          );

          // Cherry-pick each commit to the main repo
          for (const hash of commitHashes) {
            try {
              await execFileAsync(
                'git', ['cherry-pick', '--no-edit', hash],
                { cwd: repoRoot }
              );
            } catch (cpErr) {
              // Conflict — abort and warn. Worktree is preserved for manual merge.
              console.warn(
                `[Orchestrator] Run ${runId}: cherry-pick conflict on ${hash}, aborting merge`
              );
              await execFileAsync(
                'git', ['cherry-pick', '--abort'],
                { cwd: repoRoot }
              ).catch(() => {});
              console.warn(
                `[Orchestrator] Run ${runId}: worktree preserved at ${worktreePath} for manual merge`
              );
              return; // Don't remove worktree — user needs to resolve
            }
          }
          console.log(
            `[Orchestrator] Run ${runId}: successfully merged ${commitHashes.length} commits`
          );
        } else {
          console.log(`[Orchestrator] Run ${runId}: no forge commits to merge`);
        }
      }

      // Remove worktree after successful merge
      await this.worktreeManager!.remove(worktreePath);
    } catch (err) {
      console.warn(
        `[Orchestrator] Run ${runId}: worktree merge failed, preserving for manual review:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  private async cleanupWorktree(runId: string): Promise<void> {
    const worktreePath = this.runWorktrees.get(runId);
    if (worktreePath && this.worktreeManager) {
      await this.worktreeManager.remove(worktreePath);
      this.runWorktrees.delete(runId);
    }
  }

  /**
   * Delays execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safety net: check for uncommitted changes in the worktree after task completion.
   * If the agent forgot to commit, auto-commit with the forge marker so TASK_POST
   * and downstream tasks can see the work.
   */
  private async ensureWorkCommitted(task: Task): Promise<void> {
    const cwd = task.workspace_path;
    if (!cwd) return;

    // Resolve to absolute path
    const resolvedCwd = path.resolve(cwd);

    // Safety guard: ensure path contains .forge-worktrees/
    if (!resolvedCwd.includes('.forge-worktrees/')) {
      console.warn(
        `[Orchestrator] Task ${task.step_id}: workspace_path "${resolvedCwd}" is not a worktree — skipping auto-commit`
      );
      return;
    }

    // Safety guard: ensure directory exists
    if (!existsSync(resolvedCwd)) {
      console.warn(
        `[Orchestrator] Task ${task.step_id}: workspace_path "${resolvedCwd}" does not exist — skipping auto-commit`
      );
      return;
    }

    try {
      // Check for uncommitted changes
      const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: resolvedCwd });
      if (!status.trim()) return; // Clean worktree — agent committed properly

      console.warn(
        `[Orchestrator] Task ${task.step_id} has uncommitted changes — agent forgot to commit. Auto-committing.`
      );

      // Stage and commit with forge marker
      await execFileAsync('git', ['add', '.'], { cwd: resolvedCwd });
      await execFileAsync('git', [
        'commit', '-m',
        `[forge:${task.task_id}] Auto-commit: agent completed without committing`,
      ], { cwd: resolvedCwd });

      console.log(`[Orchestrator] Auto-committed changes for task ${task.step_id}`);
    } catch (err) {
      // Non-fatal — log and continue. The work is still in the worktree even if commit fails.
      console.warn(
        `[Orchestrator] Failed to auto-commit for task ${task.step_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  /**
   * Release (terminate) a single agent process via relay.
   * Fire-and-forget — logs errors but doesn't throw.
   */
  private releaseAgentProcess(agentId: string): void {
    if (!this.terminateAgent) return;
    this.terminateAgent(agentId).catch((err) => {
      console.warn(`[Orchestrator] Failed to release agent ${agentId}:`, err);
    });
  }

  /**
   * Terminate all active agents for a specific run.
   * Called on run completion, failure, or cancellation.
   */
  terminateRunAgents(runId: string): void {
    const agentTrackers = this.activeRuns.get(runId);
    if (!agentTrackers || agentTrackers.size === 0) return;

    console.log(
      `[Orchestrator] Terminating ${agentTrackers.size} agent(s) for run ${runId}`
    );

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

    // Stop the run loop so it doesn't dispatch more tasks
    this.runLoopActive.delete(runId);
    this.activeRuns.delete(runId);
  }

  shutdown(): void {
    console.log('[Orchestrator] Shutting down');

    // Terminate all active agents
    for (const [runId] of this.activeRuns.entries()) {
      this.terminateRunAgents(runId);
    }

    // Clear tracking state
    this.activeRuns.clear();
    this.runLoopActive.clear();
    this.childRunTrackers.clear();
    this.runTierMaps.clear();
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
