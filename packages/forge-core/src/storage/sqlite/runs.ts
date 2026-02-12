import type Database from 'better-sqlite3';
import type { Run, RunStatus } from '../../domain/types.js';
import { type RunRow, rowToRun } from './converters.js';

export function createRun(db: Database.Database, run: Run): Run {
  const stmt = db.prepare(`
    INSERT INTO runs (
      run_id, plan_id, plan_version, status, has_pending_gate, workspace_path,
      parent_run_id, parent_task_id,
      started_at, completed_at, error, document, created_at, updated_at
    )
    VALUES (
      @run_id, @plan_id, @plan_version, @status, @has_pending_gate, @workspace_path,
      @parent_run_id, @parent_task_id,
      @started_at, @completed_at, @error, @document, @created_at, @updated_at
    )
  `);
  stmt.run({
    run_id: run.run_id,
    plan_id: run.plan_id,
    plan_version: run.plan_version,
    status: run.status,
    has_pending_gate: run.has_pending_gate ? 1 : 0,
    workspace_path: run.workspace_path ?? null,
    parent_run_id: run.parent_run_id ?? null,
    parent_task_id: run.parent_task_id ?? null,
    started_at: run.started_at ?? null,
    completed_at: run.completed_at ?? null,
    error: run.error ?? null,
    document: null, // Can be populated separately if needed
    created_at: run.created_at,
    updated_at: run.updated_at,
  });
  return run;
}

export function getRun(db: Database.Database, runId: string): Run | null {
  const stmt = db.prepare<string, RunRow>(`
    SELECT run_id, plan_id, plan_version, status, has_pending_gate, workspace_path,
           parent_run_id, parent_task_id,
           started_at, completed_at, error, document, created_at, updated_at
    FROM runs
    WHERE run_id = ?
  `);
  const row = stmt.get(runId);
  if (!row) return null;
  return rowToRun(row);
}

export function updateRun(db: Database.Database, runId: string, updates: Partial<Run>): Run | null {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = @updated_at'];
  const values: Record<string, unknown> = { run_id: runId, updated_at: now };

  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.has_pending_gate !== undefined) {
    fields.push('has_pending_gate = @has_pending_gate');
    values.has_pending_gate = updates.has_pending_gate ? 1 : 0;
  }
  if (updates.started_at !== undefined) {
    fields.push('started_at = @started_at');
    values.started_at = updates.started_at ?? null;
  }
  if (updates.completed_at !== undefined) {
    fields.push('completed_at = @completed_at');
    values.completed_at = updates.completed_at ?? null;
  }
  if (updates.error !== undefined) {
    fields.push('error = @error');
    values.error = updates.error ?? null;
  }
  if ((updates as Record<string, unknown>).document !== undefined) {
    fields.push('document = @document');
    values.document = (updates as Record<string, unknown>).document ?? null;
  }

  const stmt = db.prepare(`
    UPDATE runs
    SET ${fields.join(', ')}
    WHERE run_id = @run_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getRun(db, runId);
}

/**
 * Get the raw document JSON stored with a run (plan-level context, understanding).
 */
export function getRunDocument(db: Database.Database, runId: string): Record<string, unknown> | null {
  const stmt = db.prepare<string, { document: string | null }>(`
    SELECT document FROM runs WHERE run_id = ?
  `);
  const row = stmt.get(runId);
  if (!row?.document) return null;
  try {
    return JSON.parse(row.document) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Store a document JSON on a run (plan-level context, understanding).
 */
export function setRunDocument(db: Database.Database, runId: string, document: Record<string, unknown>): void {
  const stmt = db.prepare(`
    UPDATE runs SET document = @document, updated_at = @updated_at WHERE run_id = @run_id
  `);
  stmt.run({
    run_id: runId,
    document: JSON.stringify(document),
    updated_at: new Date().toISOString(),
  });
}

export function updateRunStatus(db: Database.Database, runId: string, status: RunStatus): Run | null {
  return updateRun(db, runId, { status });
}

export function updateRunGateFlag(db: Database.Database, runId: string, hasPendingGate: boolean): Run | null {
  return updateRun(db, runId, { has_pending_gate: hasPendingGate });
}

export function listRuns(db: Database.Database, status?: RunStatus): Run[] {
  let sql = `
    SELECT run_id, plan_id, plan_version, status, has_pending_gate, workspace_path,
           parent_run_id, parent_task_id,
           started_at, completed_at, error, document, created_at, updated_at
    FROM runs
  `;
  const params: unknown[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare<unknown[], RunRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToRun(row));
}

export function getActiveRuns(db: Database.Database): Run[] {
  const stmt = db.prepare<[], RunRow>(`
    SELECT run_id, plan_id, plan_version, status, has_pending_gate, workspace_path,
           parent_run_id, parent_task_id,
           started_at, completed_at, error, document, created_at, updated_at
    FROM runs
    WHERE status IN ('running', 'paused')
    ORDER BY created_at ASC
  `);
  const rows = stmt.all();
  return rows.map((row) => rowToRun(row));
}

/**
 * Find completed runs for a given plan_id.
 * Used for already-built detection to check if a plan has been executed before.
 */
export function findCompletedRunsForPlan(
  db: Database.Database,
  planId: string
): { run_id: string; completed_at: string | null }[] {
  const stmt = db.prepare<string, { run_id: string; completed_at: string | null }>(`
    SELECT run_id, completed_at
    FROM runs
    WHERE plan_id = ? AND status = 'completed'
    ORDER BY completed_at DESC
  `);
  return stmt.all(planId);
}
