import type Database from 'better-sqlite3';
import type { TaskExecutionMetric } from '../../domain/types.js';
import { type TaskExecutionMetricRow, rowToTaskExecutionMetric } from './converters.js';

export function saveTaskMetric(db: Database.Database, metric: TaskExecutionMetric): TaskExecutionMetric {
  const stmt = db.prepare(`
    INSERT INTO task_execution_metrics (
      metric_id, task_id, run_id, model_id, complexity_score,
      duration_ms, tokens_used, cost_usd, outcome, confidence, created_at
    )
    VALUES (
      @metric_id, @task_id, @run_id, @model_id, @complexity_score,
      @duration_ms, @tokens_used, @cost_usd, @outcome, @confidence, @created_at
    )
  `);
  stmt.run({
    metric_id: metric.metric_id,
    task_id: metric.task_id,
    run_id: metric.run_id,
    model_id: metric.model_id ?? null,
    complexity_score: metric.complexity_score ?? null,
    duration_ms: metric.duration_ms ?? null,
    tokens_used: metric.tokens_used ?? null,
    cost_usd: metric.cost_usd ?? null,
    outcome: metric.outcome ?? null,
    confidence: metric.confidence ?? null,
    created_at: metric.created_at,
  });
  return metric;
}

export function getTaskMetrics(db: Database.Database, runId: string): TaskExecutionMetric[] {
  const stmt = db.prepare<string, TaskExecutionMetricRow>(`
    SELECT metric_id, task_id, run_id, model_id, complexity_score,
           duration_ms, tokens_used, cost_usd, outcome, confidence, created_at
    FROM task_execution_metrics
    WHERE run_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToTaskExecutionMetric(row));
}

export function getTaskMetricsByModel(db: Database.Database, modelId: string): TaskExecutionMetric[] {
  const stmt = db.prepare<string, TaskExecutionMetricRow>(`
    SELECT metric_id, task_id, run_id, model_id, complexity_score,
           duration_ms, tokens_used, cost_usd, outcome, confidence, created_at
    FROM task_execution_metrics
    WHERE model_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(modelId);
  return rows.map((row) => rowToTaskExecutionMetric(row));
}

export interface RunBudgetRow {
  run_id: string;
  tokens_allowed: number | null;
  tokens_used: number;
  cost_allowed_usd: number | null;
  cost_used_usd: number;
  updated_at: string;
}

export function initRunBudget(
  db: Database.Database,
  runId: string,
  tokensAllowed?: number,
  costAllowedUsd?: number
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO run_budgets (
      run_id, tokens_allowed, tokens_used, cost_allowed_usd, cost_used_usd, updated_at
    )
    VALUES (
      @run_id, @tokens_allowed, 0, @cost_allowed_usd, 0, @updated_at
    )
  `);
  stmt.run({
    run_id: runId,
    tokens_allowed: tokensAllowed ?? null,
    cost_allowed_usd: costAllowedUsd ?? null,
    updated_at: now,
  });
}

export function updateRunBudget(
  db: Database.Database,
  runId: string,
  tokensUsed: number,
  costUsed: number
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE run_budgets
    SET tokens_used = tokens_used + @tokens_used,
        cost_used_usd = cost_used_usd + @cost_used,
        updated_at = @updated_at
    WHERE run_id = @run_id
  `);
  stmt.run({
    run_id: runId,
    tokens_used: tokensUsed,
    cost_used: costUsed,
    updated_at: now,
  });
}

export function getRunBudget(db: Database.Database, runId: string): {
  tokens_used: number;
  tokens_allowed: number | null;
  cost_used_usd: number;
  cost_allowed_usd: number | null;
} | null {
  const stmt = db.prepare<string, RunBudgetRow>(`
    SELECT run_id, tokens_allowed, tokens_used, cost_allowed_usd, cost_used_usd, updated_at
    FROM run_budgets
    WHERE run_id = ?
  `);
  const row = stmt.get(runId);
  if (!row) return null;
  return {
    tokens_used: row.tokens_used,
    tokens_allowed: row.tokens_allowed,
    cost_used_usd: row.cost_used_usd,
    cost_allowed_usd: row.cost_allowed_usd,
  };
}
