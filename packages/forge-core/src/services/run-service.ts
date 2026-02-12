/**
 * RunService - DOT Framework Integration Service
 *
 * Integrates all DOT Framework services for run orchestration:
 * - BudgetService: Token/time/cost tracking
 * - TaskQueue: Parallelism control
 * - ConfidenceHandler: Confidence threshold handling
 * - TaskFailureHandler: Recovery strategy ladder
 * - TaskTimeoutManager: Per-task timeout enforcement
 *
 * This service provides a unified interface for run execution
 * with all DOT Framework knobs applied.
 */

import type { ForgeStorage } from '../storage/interface.js';
import type { ExecutionPolicy, Task, Run } from '../domain/types.js';
import { DEFAULT_EXECUTION_POLICY } from '../domain/types.js';
import { TrajectoryCapture } from './trajectory-capture.js';
import { BudgetService, createBudgetService } from './budget-service.js';
import { TaskQueue, createTaskQueue } from './task-queue.js';
import { ConfidenceHandler, createConfidenceHandler, ConfidenceAction } from './confidence-handler.js';
import { TaskFailureHandler, createTaskFailureHandler, type RetryTaskFn } from './recovery.js';
import { TaskTimeoutManager, createTaskTimeoutManager } from './health-monitor.js';
import { ModelSelector, createModelSelector, type ModelSelectionResult } from './model-selector.js';
import { ArtifactValidator, createArtifactValidator } from './artifact-validator.js';
import type { GateService } from './gate-service.js';
import { estimateComplexityScore } from './complexity-estimator.js';

// ============================================
// Types
// ============================================

/**
 * Task outcome for emission to Tuner.
 * This is a subset of the full TaskOutcome from tuner package.
 */
export interface TaskOutcomeEmission {
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
  confidence_score?: number;
  error_category?: string;
  /** Automated verification results (from TASK_POST) */
  verification?: {
    tests_passed?: boolean | null;
    build_passed?: boolean | null;
    type_check_passed?: boolean | null;
    lint_passed?: boolean | null;
  };
  /** Acceptance criteria results (from TASK_POST) */
  ac_results?: Array<{ ac_id: string; passed: boolean; evidence?: string }>;
  timestamp: string;
  source?: 'test' | 'production' | 'training';
}

/**
 * Run outcome for emission to Tuner.
 */
export interface RunOutcomeEmission {
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
  /** Aggregate verification summary (from RUN_POST) */
  verification_summary?: {
    tests_passed_count: number;
    tests_failed_count: number;
    builds_passed_count: number;
    builds_failed_count: number;
    ac_met_count: number;
    ac_total_count: number;
  };
  timestamp: string;
  source?: 'test' | 'production' | 'training';
}

/**
 * Interface for outcome emission (implemented by TunerClient).
 * Decouples forge-core from direct tuner dependency.
 */
export interface OutcomeEmitter {
  submitTaskOutcome(outcome: TaskOutcomeEmission): Promise<void>;
  submitRunOutcome(outcome: RunOutcomeEmission): Promise<void>;
}

/**
 * Configuration for RunService
 */
export interface RunServiceConfig {
  /** Storage for persistence */
  storage: ForgeStorage;
  /** Trajectory capture for observability */
  trajectoryCapture?: TrajectoryCapture;
  /** Gate service for escalation */
  gateService?: GateService;
  /** Function to retry a failed task */
  retryTask?: RetryTaskFn;
  /** Function to signal agent for shutdown */
  signalAgentShutdown?: (agentId: string, reason: string) => Promise<void>;
  /** Function to fail a task with timeout */
  failTaskWithTimeout?: (taskId: string, runId: string) => Promise<void>;
  /** Outcome emitter for Tuner integration (optional) */
  outcomeEmitter?: OutcomeEmitter;
}

/**
 * Task with model recommendation
 */
export interface TaskWithModel {
  task: Task;
  modelSelection: ModelSelectionResult;
}

/**
 * Result of task dispatch decision
 */
export interface TaskDispatchDecision {
  /** Tasks that should be dispatched with model recommendations */
  tasksToDispatch: TaskWithModel[];
  /** Tasks that are blocked by budget */
  blockedByBudget: Task[];
  /** Tasks that are blocked by parallelism */
  blockedByParallelism: Task[];
  /** Tasks that are blocked by missing artifacts */
  blockedByArtifacts: Task[];
  /** Current budget status */
  budgetOk: boolean;
  /** Warning message if any */
  warning?: string;
}

/**
 * Result of handling task completion
 */
export interface TaskCompletionResult {
  /** Whether completion was accepted */
  accepted: boolean;
  /** Action taken based on confidence */
  confidenceAction: ConfidenceAction;
  /** Message about the result */
  message: string;
}

// ============================================
// RunService
// ============================================

/**
 * RunService orchestrates task execution with DOT Framework controls.
 *
 * Responsibilities:
 * - Initialize budget tracking for runs
 * - Select ready tasks respecting parallelism limits
 * - Validate task completions against confidence thresholds
 * - Handle task failures with recovery ladder
 * - Enforce per-task timeouts
 */
export class RunService {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture | null;
  private outcomeEmitter: OutcomeEmitter | null;
  private retryTaskFn: RetryTaskFn;

  // DOT Framework services
  private budgetService: BudgetService;
  private taskQueue: TaskQueue;
  private confidenceHandler: ConfidenceHandler;
  private taskFailureHandler: TaskFailureHandler;
  private taskTimeoutManager: TaskTimeoutManager;
  private modelSelector: ModelSelector;
  private artifactValidator: ArtifactValidator;

  constructor(config: RunServiceConfig) {
    this.storage = config.storage;
    this.trajectoryCapture = config.trajectoryCapture ?? null;
    this.outcomeEmitter = config.outcomeEmitter ?? null;
    this.retryTaskFn = config.retryTask ?? (async () => {});

    // Create trajectory capture if not provided
    const trajectoryCapture = config.trajectoryCapture ??
      new TrajectoryCapture(config.storage);

    // Initialize DOT services
    this.budgetService = createBudgetService(config.storage, trajectoryCapture);
    this.taskQueue = createTaskQueue();
    this.confidenceHandler = createConfidenceHandler(
      config.storage,
      undefined, // Uses default config
      trajectoryCapture
    );

    this.taskFailureHandler = createTaskFailureHandler(
      config.storage,
      this.retryTaskFn,
      {
        trajectoryCapture,
        gateService: config.gateService,
      }
    );

    this.taskTimeoutManager = createTaskTimeoutManager({
      trajectoryCapture,
      signalAgentShutdown: config.signalAgentShutdown,
      failTaskWithTimeout: config.failTaskWithTimeout,
    });

    // Initialize model selector and artifact validator
    this.modelSelector = createModelSelector();
    this.artifactValidator = createArtifactValidator(config.storage);
  }

  /**
   * Initializes DOT Framework tracking for a run.
   * Call this when a run starts.
   *
   * @param run - The run to initialize
   */
  initializeRun(run: Run): void {
    const policy = run.execution_policy ?? DEFAULT_EXECUTION_POLICY;

    // Initialize budget tracking
    this.budgetService.initBudget(run.run_id, policy);

    // Update task queue with parallelism config
    this.taskQueue.updateConfig(policy.parallelism);

    // Update confidence thresholds
    this.confidenceHandler.updateConfig(policy.confidence);

    // Start timeout monitoring
    if (!this.taskTimeoutManager.getTrackedCount()) {
      this.taskTimeoutManager.start();
    }

    console.log(
      `[RunService] Initialized DOT services for run ${run.run_id} ` +
      `(max_concurrent: ${policy.parallelism.max_concurrent_tasks}, ` +
      `budget: $${policy.budgets.total_cost_limit_usd})`
    );
  }

  /**
   * Decides which tasks to dispatch from a set of ready tasks.
   *
   * @param readyTasks - Tasks that are ready to execute (dependencies met)
   * @param runningTasks - Tasks currently being executed
   * @param runId - The run these tasks belong to
   * @returns Decision about which tasks to dispatch
   */
  decideTaskDispatch(
    readyTasks: Task[],
    runningTasks: Task[],
    runId: string
  ): TaskDispatchDecision {
    // Check budget first
    const budgetCheck = this.budgetService.checkBudget(runId);

    if (!budgetCheck.ok) {
      return {
        tasksToDispatch: [],
        blockedByBudget: readyTasks,
        blockedByParallelism: [],
        blockedByArtifacts: [],
        budgetOk: false,
        warning: budgetCheck.message,
      };
    }

    // Filter by artifact availability
    const artifactReadyTasks = this.artifactValidator.filterReadyTasks(readyTasks, runId);
    const blockedByArtifacts = readyTasks.filter(
      t => !artifactReadyTasks.some(art => art.task_id === t.task_id)
    );

    // Apply parallelism limits via task queue
    const selectedTaskIds = this.taskQueue.selectNextTasks(artifactReadyTasks, runningTasks);
    const selectedTasks = artifactReadyTasks.filter(t => selectedTaskIds.includes(t.task_id));
    const blockedByParallelism = artifactReadyTasks.filter(t => !selectedTaskIds.includes(t.task_id));

    // Add model selection for each task to dispatch
    const tasksWithModels: TaskWithModel[] = selectedTasks.map(task => ({
      task,
      modelSelection: this.modelSelector.selectModelForTask({
        task,
        runId,
        // Estimate complexity based on task metadata
        complexityScore: estimateComplexityScore(task),
        stepRole: task.owner_role,
      }),
    }));

    return {
      tasksToDispatch: tasksWithModels,
      blockedByBudget: [],
      blockedByParallelism,
      blockedByArtifacts,
      budgetOk: true,
      warning: budgetCheck.warning_level !== 'none' ? budgetCheck.message : undefined,
    };
  }

  /**
   * Tracks a task for timeout enforcement when it starts.
   *
   * @param task - The task that started
   * @param runId - Run the task belongs to
   * @param executionPolicy - Policy with timeout configuration
   */
  trackTaskStart(task: Task, runId: string, executionPolicy?: ExecutionPolicy): void {
    const policy = executionPolicy ?? DEFAULT_EXECUTION_POLICY;
    this.taskTimeoutManager.trackTask(task, runId, policy.budgets);
  }

  /**
   * Handles task completion, validating against confidence thresholds.
   *
   * @param task - The completed task
   * @param runId - Run the task belongs to
   * @param confidence - Confidence score reported by agent
   * @param usage - Resource usage to record
   * @returns Result indicating whether completion was accepted
   */
  handleTaskCompletion(
    task: Task,
    runId: string,
    confidence: number,
    usage?: { tokens?: number; cost?: number; duration_ms?: number; model_id?: string }
  ): TaskCompletionResult {
    // Stop tracking timeout
    this.taskTimeoutManager.untrackTask(task.task_id);

    // Record usage
    if (usage) {
      this.budgetService.recordUsage(runId, task.task_id, {
        ...usage,
        confidence,
        outcome: 'success',
      });
    }

    // Check confidence threshold
    const confidenceResult = this.confidenceHandler.checkConfidence({
      task,
      runId,
      confidence,
    });

    return {
      accepted: confidenceResult.action === ConfidenceAction.Continue,
      confidenceAction: confidenceResult.action,
      message: confidenceResult.message,
    };
  }

  /**
   * Handles task failure with recovery ladder.
   *
   * @param task - The failed task
   * @param runId - Run the task belongs to
   * @param attemptNumber - Current attempt number
   * @param errorMessage - Error message from failure
   * @param executionPolicy - Policy with retry configuration
   */
  async handleTaskFailure(
    task: Task,
    runId: string,
    attemptNumber: number,
    errorMessage?: string,
    executionPolicy?: ExecutionPolicy
  ): Promise<void> {
    // Stop tracking timeout
    this.taskTimeoutManager.untrackTask(task.task_id);

    // Record failure in budget tracking
    this.budgetService.recordUsage(runId, task.task_id, {
      outcome: 'failure',
    });

    // Apply recovery ladder
    const policy = executionPolicy ?? DEFAULT_EXECUTION_POLICY;
    await this.taskFailureHandler.handleTaskFailure(
      {
        task,
        runId,
        attemptNumber,
        errorMessage,
      },
      policy.retry
    );
  }

  /**
   * Gets the budget service for direct access.
   */
  getBudgetService(): BudgetService {
    return this.budgetService;
  }

  /**
   * Gets the task queue for direct access.
   */
  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  /**
   * Gets the confidence handler for direct access.
   */
  getConfidenceHandler(): ConfidenceHandler {
    return this.confidenceHandler;
  }

  /**
   * Gets the task failure handler for direct access.
   */
  getTaskFailureHandler(): TaskFailureHandler {
    return this.taskFailureHandler;
  }

  /**
   * Gets the timeout manager for direct access.
   */
  getTaskTimeoutManager(): TaskTimeoutManager {
    return this.taskTimeoutManager;
  }

  /**
   * Gets the model selector for direct access.
   */
  getModelSelector(): ModelSelector {
    return this.modelSelector;
  }

  /**
   * Gets the artifact validator for direct access.
   */
  getArtifactValidator(): ArtifactValidator {
    return this.artifactValidator;
  }

  /**
   * Records artifacts produced by a completed task.
   * Call this after task completion to register output artifacts.
   *
   * @param task - The completed task
   * @param runId - Run the task belongs to
   */
  async recordTaskArtifacts(task: Task, runId: string): Promise<void> {
    await this.artifactValidator.recordTaskOutputs(task, runId);
  }

  /**
   * Emits a task outcome to Tuner for learning.
   * Fire-and-forget: errors are logged but don't block execution.
   *
   * @param outcome - Task outcome to emit
   */
  async emitTaskOutcome(outcome: TaskOutcomeEmission): Promise<void> {
    if (!this.outcomeEmitter) return;

    try {
      await this.outcomeEmitter.submitTaskOutcome(outcome);
    } catch (err) {
      console.warn(
        `[RunService] Failed to emit task outcome for ${outcome.task_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  /**
   * Emits a run outcome to Tuner for learning.
   * Fire-and-forget: errors are logged but don't block execution.
   *
   * @param outcome - Run outcome to emit
   */
  async emitRunOutcome(outcome: RunOutcomeEmission): Promise<void> {
    if (!this.outcomeEmitter) return;

    try {
      await this.outcomeEmitter.submitRunOutcome(outcome);
    } catch (err) {
      console.warn(
        `[RunService] Failed to emit run outcome for ${outcome.run_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  /**
   * Gets the outcome emitter for direct access.
   */
  getOutcomeEmitter(): OutcomeEmitter | null {
    return this.outcomeEmitter;
  }

  /**
   * Sets the outcome emitter.
   * Useful for lazy initialization when TunerClient becomes available.
   *
   * @param emitter - Outcome emitter to use
   */
  setOutcomeEmitter(emitter: OutcomeEmitter): void {
    this.outcomeEmitter = emitter;
  }

  /**
   * Sets the retry task function.
   * Called by orchestrator to wire the retry mechanism.
   *
   * @param retryFn - Function to retry a task
   */
  setRetryTaskFn(retryFn: RetryTaskFn): void {
    this.retryTaskFn = retryFn;
    // Update the task failure handler with the new retry function
    this.taskFailureHandler = createTaskFailureHandler(
      this.storage,
      retryFn,
      {
        trajectoryCapture: this.trajectoryCapture ?? undefined,
        gateService: undefined, // Gate service is set during construction
      }
    );
  }

  /**
   * Shuts down the run service.
   * Call this when the Forge server is shutting down.
   */
  shutdown(): void {
    this.taskTimeoutManager.stop();
    this.taskTimeoutManager.clearAll();
  }
}

/**
 * Factory function to create RunService.
 */
export function createRunService(config: RunServiceConfig): RunService {
  return new RunService(config);
}
