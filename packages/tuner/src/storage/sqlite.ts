/**
 * SQLite storage implementation for Tuner.
 */

import Database from 'better-sqlite3';
import type { TaskOutcome, RunOutcome, VerificationResults, ACResult } from '../domain/outcome.js';
import type { TaskBaseline, ModelBaseline } from '../domain/baseline.js';
import type { DriftAlert } from '../domain/drift.js';
import type { ForgeExecutionConfig, PlannerConfig } from '../domain/config.js';
import type {
  TunerStorage,
  DriftAlertFilter,
  ConfigVersion,
  InsightsSummary,
} from './interface.js';
import { SCHEMA_STATEMENTS } from './schema.js';

// ============================================================================
// Row Types
// ============================================================================

interface TaskOutcomeRow {
  id: number;
  run_id: string;
  task_id: string;
  step_id: string;
  model_used: string;
  complexity_estimate: string | null;
  language_tier: string | null;
  outcome: string;
  error_category: string | null;
  attempts: number;
  duration_seconds: number;
  tokens_used: number;
  cost_usd: number;
  confidence_score: number | null;
  tests_passed: number | null;
  tests_total: number | null;
  tests_failed_count: number | null;
  build_passed: number | null;
  type_check_passed: number | null;
  lint_passed: number | null;
  ac_results: string | null;
  timestamp: string;
  source: string;
}

interface RunOutcomeRow {
  id: number;
  run_id: string;
  plan_id: string;
  outcome: string;
  tasks_total: number;
  tasks_succeeded: number;
  tasks_failed: number;
  total_duration_seconds: number;
  total_tokens: number;
  total_cost_usd: number;
  replan_count: number;
  escalation_count: number;
  tests_passed_count: number;
  tests_failed_count: number;
  builds_passed_count: number;
  builds_failed_count: number;
  ac_met_count: number;
  ac_total_count: number;
  timestamp: string;
  source: string;
}

interface TaskBaselineRow {
  pattern: string;
  mean_duration_seconds: number;
  stddev_duration_seconds: number;
  mean_tokens: number;
  stddev_tokens: number;
  mean_attempts: number;
  success_rate: number;
  verification_pass_rate: number | null;
  m2_duration: number | null;
  m2_tokens: number | null;
  sample_count: number;
  last_updated: string;
}

interface ModelBaselineRow {
  model: string;
  task_type: string;
  complexity: string;
  alpha: number;
  beta: number;
  total_attempts: number;
  success_rate: number;
  mean_cost_per_success: number;
  last_updated: string;
}

interface DriftAlertRow {
  id: string;
  type: string;
  pattern: string;
  current_value: number;
  baseline_value: number;
  stddev: number;
  deviation_sigmas: number;
  severity: string;
  acknowledged: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  timestamp: string;
}

interface ConfigVersionRow {
  version: number;
  forge_config: string;
  planner_config: string;
  generated_at: string;
  notes: string | null;
}

// ============================================================================
// SQLite Storage Implementation
// ============================================================================

export class SQLiteTunerStorage implements TunerStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    for (const statement of SCHEMA_STATEMENTS) {
      this.db.exec(statement);
    }
  }

  // -------------------------------------------------------------------------
  // Task Outcomes
  // -------------------------------------------------------------------------

  insertTaskOutcome(outcome: TaskOutcome): void {
    const stmt = this.db.prepare(`
      INSERT INTO task_outcomes (
        run_id, task_id, step_id, model_used, complexity_estimate, language_tier,
        outcome, error_category, attempts, duration_seconds, tokens_used, cost_usd,
        confidence_score, tests_passed, tests_total, tests_failed_count,
        build_passed, type_check_passed, lint_passed, ac_results, timestamp, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      outcome.run_id,
      outcome.task_id,
      outcome.step_id,
      outcome.model_used,
      outcome.complexity_estimate,
      outcome.language_tier ?? null,
      outcome.outcome,
      outcome.error_category ?? null,
      outcome.attempts,
      outcome.duration_seconds,
      outcome.tokens_used,
      outcome.cost_usd,
      outcome.confidence_score ?? null,
      outcome.verification?.tests_passed !== undefined ? (outcome.verification.tests_passed ? 1 : 0) : null,
      outcome.verification?.tests_total ?? null,
      outcome.verification?.tests_failed_count ?? null,
      outcome.verification?.build_passed !== undefined ? (outcome.verification.build_passed ? 1 : 0) : null,
      outcome.verification?.type_check_passed !== undefined ? (outcome.verification.type_check_passed ? 1 : 0) : null,
      outcome.verification?.lint_passed !== undefined ? (outcome.verification.lint_passed ? 1 : 0) : null,
      outcome.ac_results ? JSON.stringify(outcome.ac_results) : null,
      outcome.timestamp,
      outcome.source
    );
  }

  getTaskOutcomesByRunId(runId: string): TaskOutcome[] {
    const stmt = this.db.prepare('SELECT * FROM task_outcomes WHERE run_id = ? ORDER BY timestamp');
    const rows = stmt.all(runId) as TaskOutcomeRow[];
    return rows.map(this.rowToTaskOutcome);
  }

  getRecentTaskOutcomes(limit: number): TaskOutcome[] {
    const stmt = this.db.prepare('SELECT * FROM task_outcomes ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as TaskOutcomeRow[];
    return rows.map(this.rowToTaskOutcome);
  }

  getTotalOutcomeCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM task_outcomes');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  private rowToTaskOutcome(row: TaskOutcomeRow): TaskOutcome {
    const verification: VerificationResults | undefined =
      row.tests_passed !== null || row.build_passed !== null
        ? {
            tests_passed: row.tests_passed !== null ? row.tests_passed === 1 : undefined,
            tests_total: row.tests_total ?? undefined,
            tests_failed_count: row.tests_failed_count ?? undefined,
            build_passed: row.build_passed !== null ? row.build_passed === 1 : undefined,
            type_check_passed: row.type_check_passed !== null ? row.type_check_passed === 1 : undefined,
            lint_passed: row.lint_passed !== null ? row.lint_passed === 1 : undefined,
          }
        : undefined;

    const acResults: ACResult[] | undefined = row.ac_results
      ? JSON.parse(row.ac_results)
      : undefined;

    return {
      run_id: row.run_id,
      task_id: row.task_id,
      step_id: row.step_id,
      model_used: row.model_used,
      complexity_estimate: row.complexity_estimate ?? '',
      language_tier: row.language_tier ?? undefined,
      outcome: row.outcome as TaskOutcome['outcome'],
      error_category: row.error_category as TaskOutcome['error_category'],
      attempts: row.attempts,
      duration_seconds: row.duration_seconds,
      tokens_used: row.tokens_used,
      cost_usd: row.cost_usd,
      confidence_score: row.confidence_score ?? undefined,
      verification,
      ac_results: acResults,
      timestamp: row.timestamp,
      source: row.source as TaskOutcome['source'],
    };
  }

  // -------------------------------------------------------------------------
  // Run Outcomes
  // -------------------------------------------------------------------------

  insertRunOutcome(outcome: RunOutcome): void {
    const stmt = this.db.prepare(`
      INSERT INTO run_outcomes (
        run_id, plan_id, outcome, tasks_total, tasks_succeeded, tasks_failed,
        total_duration_seconds, total_tokens, total_cost_usd, replan_count,
        escalation_count, tests_passed_count, tests_failed_count, builds_passed_count,
        builds_failed_count, ac_met_count, ac_total_count, timestamp, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      outcome.run_id,
      outcome.plan_id,
      outcome.outcome,
      outcome.tasks_total,
      outcome.tasks_succeeded,
      outcome.tasks_failed,
      outcome.total_duration_seconds,
      outcome.total_tokens,
      outcome.total_cost_usd,
      outcome.replan_count,
      outcome.escalation_count,
      outcome.verification_summary?.tests_passed_count ?? 0,
      outcome.verification_summary?.tests_failed_count ?? 0,
      outcome.verification_summary?.builds_passed_count ?? 0,
      outcome.verification_summary?.builds_failed_count ?? 0,
      outcome.verification_summary?.ac_met_count ?? 0,
      outcome.verification_summary?.ac_total_count ?? 0,
      outcome.timestamp,
      outcome.source
    );
  }

  getRunOutcome(runId: string): RunOutcome | null {
    const stmt = this.db.prepare('SELECT * FROM run_outcomes WHERE run_id = ?');
    const row = stmt.get(runId) as RunOutcomeRow | undefined;
    return row ? this.rowToRunOutcome(row) : null;
  }

  getRecentRunOutcomes(limit: number): RunOutcome[] {
    const stmt = this.db.prepare('SELECT * FROM run_outcomes ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as RunOutcomeRow[];
    return rows.map(this.rowToRunOutcome);
  }

  private rowToRunOutcome(row: RunOutcomeRow): RunOutcome {
    return {
      run_id: row.run_id,
      plan_id: row.plan_id,
      outcome: row.outcome as RunOutcome['outcome'],
      tasks_total: row.tasks_total,
      tasks_succeeded: row.tasks_succeeded,
      tasks_failed: row.tasks_failed,
      total_duration_seconds: row.total_duration_seconds,
      total_tokens: row.total_tokens,
      total_cost_usd: row.total_cost_usd,
      replan_count: row.replan_count,
      escalation_count: row.escalation_count,
      verification_summary: {
        tests_passed_count: row.tests_passed_count,
        tests_failed_count: row.tests_failed_count,
        builds_passed_count: row.builds_passed_count,
        builds_failed_count: row.builds_failed_count,
        ac_met_count: row.ac_met_count,
        ac_total_count: row.ac_total_count,
      },
      timestamp: row.timestamp,
      source: row.source as RunOutcome['source'],
    };
  }

  // -------------------------------------------------------------------------
  // Task Baselines
  // -------------------------------------------------------------------------

  getTaskBaseline(pattern: string): TaskBaseline | null {
    const stmt = this.db.prepare('SELECT * FROM task_baselines WHERE pattern = ?');
    const row = stmt.get(pattern) as TaskBaselineRow | undefined;
    return row ? this.rowToTaskBaseline(row) : null;
  }

  upsertTaskBaseline(baseline: TaskBaseline): void {
    const stmt = this.db.prepare(`
      INSERT INTO task_baselines (
        pattern, mean_duration_seconds, stddev_duration_seconds, mean_tokens,
        stddev_tokens, mean_attempts, success_rate, verification_pass_rate,
        m2_duration, m2_tokens, sample_count, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pattern) DO UPDATE SET
        mean_duration_seconds = excluded.mean_duration_seconds,
        stddev_duration_seconds = excluded.stddev_duration_seconds,
        mean_tokens = excluded.mean_tokens,
        stddev_tokens = excluded.stddev_tokens,
        mean_attempts = excluded.mean_attempts,
        success_rate = excluded.success_rate,
        verification_pass_rate = excluded.verification_pass_rate,
        m2_duration = excluded.m2_duration,
        m2_tokens = excluded.m2_tokens,
        sample_count = excluded.sample_count,
        last_updated = excluded.last_updated
    `);

    stmt.run(
      baseline.pattern,
      baseline.mean_duration_seconds,
      baseline.stddev_duration_seconds,
      baseline.mean_tokens,
      baseline.stddev_tokens,
      baseline.mean_attempts,
      baseline.success_rate,
      baseline.verification_pass_rate ?? null,
      baseline.m2_duration ?? 0,
      baseline.m2_tokens ?? 0,
      baseline.sample_count,
      baseline.last_updated
    );
  }

  listTaskBaselines(): TaskBaseline[] {
    const stmt = this.db.prepare('SELECT * FROM task_baselines ORDER BY sample_count DESC');
    const rows = stmt.all() as TaskBaselineRow[];
    return rows.map(this.rowToTaskBaseline);
  }

  private rowToTaskBaseline(row: TaskBaselineRow): TaskBaseline {
    return {
      pattern: row.pattern,
      mean_duration_seconds: row.mean_duration_seconds,
      stddev_duration_seconds: row.stddev_duration_seconds,
      mean_tokens: row.mean_tokens,
      stddev_tokens: row.stddev_tokens,
      mean_attempts: row.mean_attempts,
      success_rate: row.success_rate,
      verification_pass_rate: row.verification_pass_rate ?? undefined,
      m2_duration: row.m2_duration ?? undefined,
      m2_tokens: row.m2_tokens ?? undefined,
      sample_count: row.sample_count,
      last_updated: row.last_updated,
    };
  }

  // -------------------------------------------------------------------------
  // Model Baselines
  // -------------------------------------------------------------------------

  getModelBaseline(model: string, taskType: string, complexity: string): ModelBaseline | null {
    const stmt = this.db.prepare(
      'SELECT * FROM model_baselines WHERE model = ? AND task_type = ? AND complexity = ?'
    );
    const row = stmt.get(model, taskType, complexity) as ModelBaselineRow | undefined;
    return row ? this.rowToModelBaseline(row) : null;
  }

  upsertModelBaseline(baseline: ModelBaseline): void {
    const stmt = this.db.prepare(`
      INSERT INTO model_baselines (
        model, task_type, complexity, alpha, beta, total_attempts,
        success_rate, mean_cost_per_success, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(model, task_type, complexity) DO UPDATE SET
        alpha = excluded.alpha,
        beta = excluded.beta,
        total_attempts = excluded.total_attempts,
        success_rate = excluded.success_rate,
        mean_cost_per_success = excluded.mean_cost_per_success,
        last_updated = excluded.last_updated
    `);

    stmt.run(
      baseline.model,
      baseline.task_type,
      baseline.complexity,
      baseline.alpha,
      baseline.beta,
      baseline.total_attempts,
      baseline.success_rate,
      baseline.mean_cost_per_success,
      baseline.last_updated
    );
  }

  listModelBaselines(): ModelBaseline[] {
    const stmt = this.db.prepare('SELECT * FROM model_baselines ORDER BY model, task_type, complexity');
    const rows = stmt.all() as ModelBaselineRow[];
    return rows.map(this.rowToModelBaseline);
  }

  private rowToModelBaseline(row: ModelBaselineRow): ModelBaseline {
    return {
      model: row.model,
      task_type: row.task_type,
      complexity: row.complexity,
      alpha: row.alpha,
      beta: row.beta,
      total_attempts: row.total_attempts,
      success_rate: row.success_rate,
      mean_cost_per_success: row.mean_cost_per_success,
      last_updated: row.last_updated,
    };
  }

  // -------------------------------------------------------------------------
  // Drift Alerts
  // -------------------------------------------------------------------------

  insertDriftAlert(alert: DriftAlert): void {
    const stmt = this.db.prepare(`
      INSERT INTO drift_alerts (
        id, type, pattern, current_value, baseline_value, stddev,
        deviation_sigmas, severity, acknowledged, acknowledged_by,
        acknowledged_at, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      alert.id,
      alert.type,
      alert.pattern,
      alert.current_value,
      alert.baseline_value,
      alert.stddev,
      alert.deviation_sigmas,
      alert.severity,
      alert.acknowledged ? 1 : 0,
      alert.acknowledged_by ?? null,
      alert.acknowledged_at ?? null,
      alert.timestamp
    );
  }

  getDriftAlerts(filter?: DriftAlertFilter): DriftAlert[] {
    let sql = 'SELECT * FROM drift_alerts WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.severity) {
      sql += ' AND severity = ?';
      params.push(filter.severity);
    }

    if (filter?.acknowledged !== undefined) {
      sql += ' AND acknowledged = ?';
      params.push(filter.acknowledged ? 1 : 0);
    }

    if (filter?.pattern) {
      sql += ' AND pattern = ?';
      params.push(filter.pattern);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as DriftAlertRow[];
    return rows.map(this.rowToDriftAlert);
  }

  acknowledgeDriftAlert(alertId: string, acknowledgedBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE drift_alerts
      SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
      WHERE id = ? AND acknowledged = 0
    `);

    const result = stmt.run(acknowledgedBy, new Date().toISOString(), alertId);
    return result.changes > 0;
  }

  getActiveAlertCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM drift_alerts WHERE acknowledged = 0');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  private rowToDriftAlert(row: DriftAlertRow): DriftAlert {
    return {
      id: row.id,
      type: row.type as DriftAlert['type'],
      pattern: row.pattern,
      current_value: row.current_value,
      baseline_value: row.baseline_value,
      stddev: row.stddev,
      deviation_sigmas: row.deviation_sigmas,
      severity: row.severity as DriftAlert['severity'],
      acknowledged: row.acknowledged === 1,
      acknowledged_by: row.acknowledged_by ?? undefined,
      acknowledged_at: row.acknowledged_at ?? undefined,
      timestamp: row.timestamp,
    };
  }

  // -------------------------------------------------------------------------
  // Config Versions
  // -------------------------------------------------------------------------

  insertConfigVersion(version: ConfigVersion): void {
    const stmt = this.db.prepare(`
      INSERT INTO config_versions (version, forge_config, planner_config, generated_at, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      version.version,
      JSON.stringify(version.forge_config),
      JSON.stringify(version.planner_config),
      version.generated_at,
      version.notes ?? null
    );
  }

  getLatestConfigVersion(): ConfigVersion | null {
    const stmt = this.db.prepare('SELECT * FROM config_versions ORDER BY version DESC LIMIT 1');
    const row = stmt.get() as ConfigVersionRow | undefined;
    return row ? this.rowToConfigVersion(row) : null;
  }

  getConfigVersion(version: number): ConfigVersion | null {
    const stmt = this.db.prepare('SELECT * FROM config_versions WHERE version = ?');
    const row = stmt.get(version) as ConfigVersionRow | undefined;
    return row ? this.rowToConfigVersion(row) : null;
  }

  listConfigVersions(limit: number): ConfigVersion[] {
    const stmt = this.db.prepare('SELECT * FROM config_versions ORDER BY version DESC LIMIT ?');
    const rows = stmt.all(limit) as ConfigVersionRow[];
    return rows.map(this.rowToConfigVersion);
  }

  getNextVersionNumber(): number {
    const stmt = this.db.prepare('SELECT MAX(version) as max_version FROM config_versions');
    const row = stmt.get() as { max_version: number | null };
    return (row.max_version ?? 0) + 1;
  }

  private rowToConfigVersion(row: ConfigVersionRow): ConfigVersion {
    return {
      version: row.version,
      forge_config: JSON.parse(row.forge_config),
      planner_config: JSON.parse(row.planner_config),
      generated_at: row.generated_at,
      notes: row.notes ?? undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Insights
  // -------------------------------------------------------------------------

  getInsightsSummary(): InsightsSummary {
    // Total runs and success rate
    const runStats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'completed' THEN 1 ELSE 0 END) as succeeded,
        AVG(total_cost_usd) as avg_cost,
        AVG(total_duration_seconds) as avg_duration
      FROM run_outcomes
    `).get() as {
      total: number;
      succeeded: number;
      avg_cost: number | null;
      avg_duration: number | null;
    };

    // Model distribution
    const modelDist = this.db.prepare(`
      SELECT model_used, COUNT(*) as count
      FROM task_outcomes
      GROUP BY model_used
      ORDER BY count DESC
    `).all() as Array<{ model_used: string; count: number }>;

    const totalTasks = modelDist.reduce((sum, m) => sum + m.count, 0);

    // Active drift alerts
    const activeAlerts = this.getActiveAlertCount();

    // Verification pass rate
    const verificationStats = this.db.prepare(`
      SELECT
        SUM(CASE WHEN tests_passed = 1 AND build_passed = 1 THEN 1 ELSE 0 END) as all_passed,
        COUNT(*) as total
      FROM task_outcomes
      WHERE tests_passed IS NOT NULL OR build_passed IS NOT NULL
    `).get() as { all_passed: number | null; total: number };

    return {
      total_runs: runStats.total,
      success_rate: runStats.total > 0 ? runStats.succeeded / runStats.total : 0,
      avg_cost_per_run: runStats.avg_cost ?? 0,
      avg_duration_per_run: runStats.avg_duration ?? 0,
      drift_alerts_active: activeAlerts,
      model_distribution: modelDist.map((m) => ({
        model: m.model_used,
        count: m.count,
        percentage: totalTasks > 0 ? m.count / totalTasks : 0,
      })),
      verification_pass_rate:
        verificationStats.total > 0
          ? (verificationStats.all_passed ?? 0) / verificationStats.total
          : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  close(): void {
    this.db.close();
  }
}
