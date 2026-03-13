/**
 * RunMonitor — tracks per-step timing, estimates cost, and detects stalls.
 *
 * Follows the same EventEmitter pattern as GateManager:
 *  - Extends EventEmitter<EventMap>
 *  - Has reset(), setForgeRunId(), bind() lifecycle methods
 *  - Subscribes to runner.on() in bind()
 *  - Emits domain events for SSE consumption
 */

import { EventEmitter } from 'node:events';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { WorkflowRunner, WorkflowEvent } from '@agent-relay/sdk/workflows';
import type { RelayYamlConfig } from '@agent-relay/sdk/workflows';
import { scoreStepOutput } from './satisfaction-scorer.js';
import type { AcceptanceCriterion } from './compiler.js';

// ---------------------------------------------------------------------------
// Cost model constants
// ---------------------------------------------------------------------------

/** Cost multipliers per model tier, relative to sonnet baseline. */
const MODEL_COST_MULTIPLIERS: Record<string, number> = {
  haiku: 0.27,
  sonnet: 1.0,
  opus: 4.0,
};

/** Base cost per minute of execution (USD), calibrated for sonnet. */
const BASE_COST_PER_MIN_USD = 0.05;

// ---------------------------------------------------------------------------
// Stall detection constants
// ---------------------------------------------------------------------------

/** Stall thresholds per model tier (ms). Heavier models get more time. */
const STALL_THRESHOLDS: Record<string, number> = {
  haiku: 120_000,  // 2 min
  sonnet: 300_000, // 5 min
  opus: 600_000,   // 10 min
};

const DEFAULT_STALL_THRESHOLD = 300_000; // 5 min fallback
const STALL_CHECK_INTERVAL_MS = 30_000;  // check every 30s

// ---------------------------------------------------------------------------
// Context budget constants
// ---------------------------------------------------------------------------

/** Conservative context budgets per model tier (tokens). Agents degrade before hitting window limits. */
const CONTEXT_BUDGETS: Record<string, number> = {
  haiku:  60_000,
  sonnet: 80_000,
  opus:  100_000,
};

const DEFAULT_CONTEXT_BUDGET = 80_000;

/** Conservative chars-to-tokens ratio for estimation. */
const CHARS_PER_TOKEN = 3.5;

/** Utilization thresholds for pressure events. */
const CONTEXT_PRESSURE_THRESHOLD = 0.7;
const CONTEXT_BUDGET_EXCEEDED_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Internal tracking state
// ---------------------------------------------------------------------------

interface StepTracking {
  stepName: string;
  model: string;
  startedAt: number;
  completedAt?: number;
  failures: string[];
  attempt: number;
  estimatedCostUsd: number;
  durationMs: number;
  /** Prevents duplicate stall warnings for the same step in the same attempt. */
  stallWarned: boolean;
  /** Satisfaction score 0-100 from post-execution scoring, if available. */
  score?: number;
  /** Estimated token count based on relay message sizes. */
  estimatedTokens: number;
  /** Context utilization 0.0 - 1.0 relative to model budget. */
  contextUtilization: number;
  /** Prevents duplicate pressure warnings for the same step. */
  pressureWarned: boolean;
  /** Prevents duplicate budget-exceeded warnings for the same step. */
  budgetExceededWarned: boolean;
}

// ---------------------------------------------------------------------------
// SSE event payload types (exported for use in sse.ts)
// ---------------------------------------------------------------------------

export interface StepMetricsPayload {
  run_id: string;
  step_name: string;
  model: string;
  duration_ms: number;
  estimated_cost_usd: number;
  /** Merge strategy for this step's git changes, if specified in the plan */
  merge_strategy?: string;
}

export interface RunMetricsPayload {
  run_id: string;
  total_cost_usd: number;
  steps_completed: number;
  steps_total: number;
  /** Average satisfaction score 0-100, averaged across scored steps. 0 if no steps scored. */
  avg_satisfaction: number;
  /** Maximum context utilization across all active steps. */
  max_context_utilization: number;
}

export interface StallWarningPayload {
  run_id: string;
  step_name: string;
  elapsed_ms: number;
  threshold_ms: number;
}

export interface StepRetryContextPayload {
  run_id: string;
  step_name: string;
  attempt: number;
  /** Deduplicated failures from all previous attempts (last 3) */
  previous_failures: string[];
  /** Total number of failures across all attempts */
  total_failure_count: number;
  /** Static recovery hints from the plan author */
  retry_hints?: string[];
}

export interface StepFailedEnrichedPayload {
  run_id: string;
  step_name: string;
  /** The latest error message */
  error: string;
  /** All deduplicated failures from all attempts */
  failures: string[];
  /** Current attempt number */
  attempt: number;
}

export interface StepScoredPayload {
  run_id: string;
  step_name: string;
  score: number;
  reasoning: string;
  matched_criteria: string[];
  failed_criteria: string[];
}

export interface StepRetriesExhaustedPayload {
  run_id: string;
  step_name: string;
  attempt: number;
  max_retries: number;
  failures: string[];
}

export interface StepMergeStatusPayload {
  run_id: string;
  step_name: string;
  status: 'pending' | 'merging' | 'merged' | 'failed' | 'skipped';
  branch?: string;
  target_branch?: string;
  error?: string;
}

export interface ContextPressurePayload {
  run_id: string;
  step_name: string;
  model: string;
  estimated_tokens: number;
  budget: number;
  utilization: number;
}

export interface ContextBudgetExceededPayload {
  run_id: string;
  step_name: string;
  model: string;
  estimated_tokens: number;
  budget: number;
  utilization: number;
}

// ---------------------------------------------------------------------------
// EventEmitter map
// ---------------------------------------------------------------------------

interface RunMonitorEvents {
  'step:metrics': [payload: StepMetricsPayload];
  'run:metrics': [payload: RunMetricsPayload];
  'stall:warning': [payload: StallWarningPayload];
  'step:retry-context': [payload: StepRetryContextPayload];
  'step:failed-enriched': [payload: StepFailedEnrichedPayload];
  'step:scored': [payload: StepScoredPayload];
  'step:retries-exhausted': [payload: StepRetriesExhaustedPayload];
  'step:merge-status': [payload: StepMergeStatusPayload];
  'context:pressure': [payload: ContextPressurePayload];
  'context:budget-exceeded': [payload: ContextBudgetExceededPayload];
}

// ---------------------------------------------------------------------------
// RunMonitor
// ---------------------------------------------------------------------------

export class RunMonitor extends EventEmitter<RunMonitorEvents> {
  private forgeRunId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private stallInterval: ReturnType<typeof setInterval> | null = null;

  private steps = new Map<string, StepTracking>();
  private totalSteps = 0;

  /** Resolved step name → model mapping, built from the compiled workflow config. */
  private stepToModel = new Map<string, string>();

  /** Acceptance criteria per step_id, used for post-execution satisfaction scoring. */
  private stepCriteria = new Map<string, AcceptanceCriterion[]>();

  /** Static recovery hints per step_id, included in retry context events. */
  private stepRetryHints = new Map<string, string[]>();

  /** Merge strategy per step_id, included in step completion events. */
  private stepMergeStrategies = new Map<string, string>();

  /** Max retry attempts per step. 0 means no retries configured. */
  private retryLimit = 0;

  /** Workspace path for writing retry context files. */
  private workspacePath: string | null = null;

  /**
   * Set the forge run ID. Must be called before bind().
   */
  setForgeRunId(runId: string): void {
    this.forgeRunId = runId;
  }

  /**
   * Set the workspace path for writing retry context files.
   * When set, the monitor writes `.forge/retry-context/{stepName}.md` on retries
   * so the retried agent can read prior failure context from the filesystem.
   */
  setWorkspacePath(path: string): void {
    this.workspacePath = path;
  }

  /**
   * Provide acceptance criteria per step_id for satisfaction scoring.
   * Call after compilePlan() and before bind().
   */
  setStepCriteria(criteria: Map<string, AcceptanceCriterion[]>): void {
    this.stepCriteria = new Map(criteria);
  }

  /**
   * Provide static retry hints per step_id for enriching retry context events.
   * Call after compilePlan() and before bind().
   */
  setStepRetryHints(hints: Map<string, string[]>): void {
    this.stepRetryHints = new Map(hints);
  }

  /**
   * Provide merge strategies per step_id for enriching step completion events.
   * Call after compilePlan() and before bind().
   */
  setStepMergeStrategies(strategies: Map<string, string>): void {
    this.stepMergeStrategies = new Map(strategies);
  }

  /**
   * Set the maximum retry count. When a step's attempt reaches this limit
   * on failure, a step:retries-exhausted event is emitted.
   */
  setRetryLimit(limit: number): void {
    this.retryLimit = limit;
  }

  /**
   * Provide the compiled workflow config for model resolution.
   * Walks agent definitions then step→agent references to produce a
   * step name → model tier mapping.
   */
  setWorkflowConfig(config: RelayYamlConfig): void {
    // Build agent name → model map from agent definitions
    const agentModels = new Map<string, string>();
    for (const agent of config.agents ?? []) {
      const model = agent.constraints?.model ?? 'sonnet';
      agentModels.set(agent.name, model);
    }

    // Build step name → model map from workflow step references
    this.stepToModel.clear();
    this.totalSteps = 0;
    for (const workflow of config.workflows ?? []) {
      for (const step of workflow.steps ?? []) {
        if (!step.agent) continue; // Skip deterministic hook steps (:pre/:post)
        const agentModel = agentModels.get(step.agent) ?? 'sonnet';
        this.stepToModel.set(step.name, agentModel);
        this.totalSteps++;
      }
    }
  }

  /**
   * Bind to a WorkflowRunner. Subscribes to runner events and starts
   * the stall detection interval. Must be called after setForgeRunId()
   * and setWorkflowConfig().
   */
  bind(runner: WorkflowRunner): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = runner.on((event: WorkflowEvent) => {
      this._handleEvent(event);
    });

    this.stallInterval = setInterval(() => this._checkStalls(), STALL_CHECK_INTERVAL_MS);
  }

  /**
   * Reset for a new run. Clears all tracking state and tears down subscriptions.
   * Call this before setting up a new run.
   */
  reset(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.stallInterval) {
      clearInterval(this.stallInterval);
      this.stallInterval = null;
    }
    this.forgeRunId = null;
    this.steps.clear();
    this.stepToModel.clear();
    this.stepCriteria.clear();
    this.stepRetryHints.clear();
    this.stepMergeStrategies.clear();
    this.retryLimit = 0;
    this.totalSteps = 0;
    this.workspacePath = null;
  }

  /**
   * Returns accumulated failure messages for a step across all attempts.
   * Used by downstream phases for failure analysis.
   */
  getStepFailures(stepName: string): string[] {
    return this.steps.get(stepName)?.failures ?? [];
  }

  // ---------------------------------------------------------------------------
  // Internal event handling
  // ---------------------------------------------------------------------------

  private _handleEvent(event: WorkflowEvent): void {
    if (!this.forgeRunId) return;

    switch (event.type) {
      case 'step:started': {
        const model = this.stepToModel.get(event.stepName) ?? 'sonnet';
        const existing = this.steps.get(event.stepName);
        this.steps.set(event.stepName, {
          stepName: event.stepName,
          model,
          startedAt: Date.now(),
          failures: existing?.failures ?? [],
          attempt: (existing?.attempt ?? 0) + 1,
          estimatedCostUsd: 0,
          durationMs: 0,
          stallWarned: false,
          estimatedTokens: 0,
          contextUtilization: 0,
          pressureWarned: false,
          budgetExceededWarned: false,
        });
        break;
      }

      case 'step:completed': {
        const tracking = this.steps.get(event.stepName);
        if (!tracking) break;

        tracking.completedAt = Date.now();
        tracking.durationMs = tracking.completedAt - tracking.startedAt;

        // Estimate tokens from step output size
        if (event.output) {
          tracking.estimatedTokens += Math.ceil(event.output.length / CHARS_PER_TOKEN);
        }

        // Update context utilization
        const budget = CONTEXT_BUDGETS[tracking.model] ?? DEFAULT_CONTEXT_BUDGET;
        tracking.contextUtilization = tracking.estimatedTokens / budget;

        // Emit context pressure events
        this._checkContextBudget(tracking);

        // Estimate cost: (duration_minutes * base_cost) * model_multiplier
        const durationMin = tracking.durationMs / 60_000;
        const multiplier = MODEL_COST_MULTIPLIERS[tracking.model] ?? 1.0;
        tracking.estimatedCostUsd = durationMin * BASE_COST_PER_MIN_USD * multiplier;

        const metricsPayload: StepMetricsPayload = {
          run_id: this.forgeRunId,
          step_name: event.stepName,
          model: tracking.model,
          duration_ms: tracking.durationMs,
          estimated_cost_usd: Math.round(tracking.estimatedCostUsd * 1000) / 1000,
        };

        const mergeStrategy = this.stepMergeStrategies.get(event.stepName);
        if (mergeStrategy) {
          metricsPayload.merge_strategy = mergeStrategy;
        }

        this.emit('step:metrics', metricsPayload);

        // Score step output against acceptance criteria
        const criteria = this.stepCriteria.get(event.stepName);
        if (criteria && criteria.length > 0 && event.output) {
          const result = scoreStepOutput(event.output, criteria);
          tracking.score = result.score;
          this.emit('step:scored', {
            run_id: this.forgeRunId,
            step_name: event.stepName,
            score: result.score,
            reasoning: result.reasoning,
            matched_criteria: result.matched_criteria,
            failed_criteria: result.failed_criteria,
          });
        }

        this._emitRunMetrics();
        break;
      }

      case 'step:failed': {
        const tracking = this.steps.get(event.stepName);
        if (!tracking) break;

        tracking.completedAt = Date.now();
        tracking.durationMs = tracking.completedAt - tracking.startedAt;

        if (event.error) {
          tracking.failures.push(event.error);
        }

        // Emit enriched failure event with accumulated context
        const dedupedFailures = [...new Set(tracking.failures)];
        this.emit('step:failed-enriched', {
          run_id: this.forgeRunId,
          step_name: event.stepName,
          error: event.error ?? 'Unknown error',
          failures: dedupedFailures,
          attempt: tracking.attempt,
        });

        // Check if retries are exhausted (retryLimit > 0 means retries were configured)
        if (this.retryLimit > 0 && tracking.attempt >= this.retryLimit) {
          this.emit('step:retries-exhausted', {
            run_id: this.forgeRunId,
            step_name: event.stepName,
            attempt: tracking.attempt,
            max_retries: this.retryLimit,
            failures: dedupedFailures,
          });
        }
        break;
      }

      case 'step:retrying': {
        // Reset stall warning so we don't double-warn after a retry restart
        const tracking = this.steps.get(event.stepName);
        if (tracking) {
          tracking.stallWarned = false;

          // Emit retry context with deduped failures from previous attempts
          const dedupedFailures = [...new Set(tracking.failures)];
          const lastThree = dedupedFailures.slice(-3);

          const retryPayload: StepRetryContextPayload = {
            run_id: this.forgeRunId,
            step_name: event.stepName,
            attempt: event.attempt ?? (tracking.attempt + 1),
            previous_failures: lastThree,
            total_failure_count: tracking.failures.length,
          };

          // Include retry hints if the plan author provided them
          const hints = this.stepRetryHints.get(event.stepName);
          if (hints && hints.length > 0) {
            retryPayload.retry_hints = hints;
          }

          this.emit('step:retry-context', retryPayload);

          // Write retry context file to workspace so the retried agent can read it
          this._writeRetryContextFile(
            event.stepName,
            retryPayload.attempt,
            dedupedFailures,
            hints,
          );
        }
        break;
      }

      case 'run:completed':
      case 'run:failed':
      case 'run:cancelled': {
        // Stop stall detection — run is no longer executing
        if (this.stallInterval) {
          clearInterval(this.stallInterval);
          this.stallInterval = null;
        }
        this._emitRunMetrics();
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Aggregated run metrics
  // ---------------------------------------------------------------------------

  private _emitRunMetrics(): void {
    if (!this.forgeRunId) return;

    let totalCost = 0;
    let completed = 0;
    let totalScore = 0;
    let scoredCount = 0;
    let maxUtilization = 0;

    for (const tracking of this.steps.values()) {
      totalCost += tracking.estimatedCostUsd;
      if (tracking.completedAt !== undefined) completed++;
      if (tracking.score !== undefined) {
        totalScore += tracking.score;
        scoredCount++;
      }
      if (tracking.contextUtilization > maxUtilization) {
        maxUtilization = tracking.contextUtilization;
      }
    }

    const avgSatisfaction = scoredCount > 0
      ? Math.round(totalScore / scoredCount)
      : 0;

    this.emit('run:metrics', {
      run_id: this.forgeRunId,
      total_cost_usd: Math.round(totalCost * 1000) / 1000,
      steps_completed: completed,
      steps_total: this.totalSteps,
      avg_satisfaction: avgSatisfaction,
      max_context_utilization: Math.round(maxUtilization * 100) / 100,
    });
  }

  // ---------------------------------------------------------------------------
  // Context budget tracking
  // ---------------------------------------------------------------------------

  private _checkContextBudget(tracking: StepTracking): void {
    if (!this.forgeRunId) return;

    const budget = CONTEXT_BUDGETS[tracking.model] ?? DEFAULT_CONTEXT_BUDGET;

    if (tracking.contextUtilization >= CONTEXT_BUDGET_EXCEEDED_THRESHOLD && !tracking.budgetExceededWarned) {
      tracking.budgetExceededWarned = true;
      this.emit('context:budget-exceeded', {
        run_id: this.forgeRunId,
        step_name: tracking.stepName,
        model: tracking.model,
        estimated_tokens: tracking.estimatedTokens,
        budget,
        utilization: Math.round(tracking.contextUtilization * 100) / 100,
      });
    } else if (tracking.contextUtilization >= CONTEXT_PRESSURE_THRESHOLD && !tracking.pressureWarned) {
      tracking.pressureWarned = true;
      this.emit('context:pressure', {
        run_id: this.forgeRunId,
        step_name: tracking.stepName,
        model: tracking.model,
        estimated_tokens: tracking.estimatedTokens,
        budget,
        utilization: Math.round(tracking.contextUtilization * 100) / 100,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Stall detection
  // ---------------------------------------------------------------------------

  private _checkStalls(): void {
    if (!this.forgeRunId) return;

    const now = Date.now();

    for (const tracking of this.steps.values()) {
      // Only check steps that are running (started but not yet completed)
      if (tracking.completedAt === undefined && tracking.startedAt > 0) {
        const elapsed = now - tracking.startedAt;
        const threshold = STALL_THRESHOLDS[tracking.model] ?? DEFAULT_STALL_THRESHOLD;

        if (elapsed >= threshold && !tracking.stallWarned) {
          tracking.stallWarned = true;
          this.emit('stall:warning', {
            run_id: this.forgeRunId,
            step_name: tracking.stepName,
            elapsed_ms: elapsed,
            threshold_ms: threshold,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Retry context file persistence
  // ---------------------------------------------------------------------------

  /**
   * Write a retry context file to the workspace so the retried agent can
   * read prior failure context from the filesystem.
   *
   * Uses synchronous I/O to guarantee the file exists before the relay SDK
   * spawns the retry agent (step:retrying fires right before step:started).
   */
  private _writeRetryContextFile(
    stepName: string,
    attempt: number,
    failures: string[],
    hints?: string[],
  ): void {
    if (!this.workspacePath) return;

    // Sanitize stepName to prevent path traversal (step_ids are UUIDs but be safe)
    const safeStepName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = join(this.workspacePath, '.forge', 'retry-context', `${safeStepName}.md`);

    const lines: string[] = [`# Retry Context for step: ${stepName}\n`];

    for (let i = 0; i < failures.length; i++) {
      lines.push(`## Previous failure ${i + 1}`);
      lines.push(`**Error**: ${failures[i]}\n`);
    }

    if (hints && hints.length > 0) {
      lines.push('## Recovery Guidance');
      for (const hint of hints) {
        lines.push(`- ${hint}`);
      }
      lines.push('');
    }

    lines.push(`_Next attempt: ${attempt}_\n`);

    const content = lines.join('\n');

    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
    } catch (err) {
      console.error(`[RunMonitor] Failed to write retry context for ${stepName}:`, err);
    }
  }
}
