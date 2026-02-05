/**
 * Storage interface for Tuner.
 * Defines all storage operations for outcomes, baselines, alerts, and config.
 */

import type { TaskOutcome, RunOutcome } from '../domain/outcome.js';
import type { TaskBaseline, ModelBaseline } from '../domain/baseline.js';
import type { DriftAlert } from '../domain/drift.js';
import type { ForgeExecutionConfig, PlannerConfig } from '../domain/config.js';

/**
 * Filter options for drift alerts.
 */
export interface DriftAlertFilter {
  severity?: 'warning' | 'critical';
  acknowledged?: boolean;
  pattern?: string;
  limit?: number;
}

/**
 * Config version record.
 */
export interface ConfigVersion {
  version: number;
  forge_config: ForgeExecutionConfig;
  planner_config: PlannerConfig;
  generated_at: string;
  notes?: string;
}

/**
 * Insights summary aggregate.
 */
export interface InsightsSummary {
  total_runs: number;
  success_rate: number;
  avg_cost_per_run: number;
  avg_duration_per_run: number;
  drift_alerts_active: number;
  model_distribution: Array<{ model: string; count: number; percentage: number }>;
  verification_pass_rate?: number;
}

/**
 * TunerStorage interface defines all storage operations.
 */
export interface TunerStorage {
  // -------------------------------------------------------------------------
  // Task Outcomes
  // -------------------------------------------------------------------------

  /** Insert a new task outcome */
  insertTaskOutcome(outcome: TaskOutcome): void;

  /** Get task outcomes for a run */
  getTaskOutcomesByRunId(runId: string): TaskOutcome[];

  /** Get recent task outcomes (for insights) */
  getRecentTaskOutcomes(limit: number): TaskOutcome[];

  /** Get total outcome count (for exploration rate decay) */
  getTotalOutcomeCount(): number;

  // -------------------------------------------------------------------------
  // Run Outcomes
  // -------------------------------------------------------------------------

  /** Insert a new run outcome */
  insertRunOutcome(outcome: RunOutcome): void;

  /** Get a run outcome by ID */
  getRunOutcome(runId: string): RunOutcome | null;

  /** Get recent run outcomes (for insights) */
  getRecentRunOutcomes(limit: number): RunOutcome[];

  // -------------------------------------------------------------------------
  // Task Baselines
  // -------------------------------------------------------------------------

  /** Get a task baseline by pattern */
  getTaskBaseline(pattern: string): TaskBaseline | null;

  /** Insert or update a task baseline */
  upsertTaskBaseline(baseline: TaskBaseline): void;

  /** List all task baselines */
  listTaskBaselines(): TaskBaseline[];

  // -------------------------------------------------------------------------
  // Model Baselines
  // -------------------------------------------------------------------------

  /** Get a model baseline by key */
  getModelBaseline(model: string, taskType: string, complexity: string): ModelBaseline | null;

  /** Insert or update a model baseline */
  upsertModelBaseline(baseline: ModelBaseline): void;

  /** List all model baselines */
  listModelBaselines(): ModelBaseline[];

  // -------------------------------------------------------------------------
  // Drift Alerts
  // -------------------------------------------------------------------------

  /** Insert a new drift alert */
  insertDriftAlert(alert: DriftAlert): void;

  /** Get drift alerts with optional filtering */
  getDriftAlerts(filter?: DriftAlertFilter): DriftAlert[];

  /** Acknowledge a drift alert */
  acknowledgeDriftAlert(alertId: string, acknowledgedBy: string): boolean;

  /** Get count of active (unacknowledged) alerts */
  getActiveAlertCount(): number;

  // -------------------------------------------------------------------------
  // Config Versions
  // -------------------------------------------------------------------------

  /** Insert a new config version */
  insertConfigVersion(version: ConfigVersion): void;

  /** Get the latest config version */
  getLatestConfigVersion(): ConfigVersion | null;

  /** Get a specific config version */
  getConfigVersion(version: number): ConfigVersion | null;

  /** List recent config versions (for audit trail) */
  listConfigVersions(limit: number): ConfigVersion[];

  /** Get next version number */
  getNextVersionNumber(): number;

  // -------------------------------------------------------------------------
  // Insights
  // -------------------------------------------------------------------------

  /** Get aggregate insights summary */
  getInsightsSummary(): InsightsSummary;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Close the storage connection */
  close(): void;
}
