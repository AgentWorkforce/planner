import type Database from 'better-sqlite3';
import type { TaskAttempt } from '../../domain/types.js';
import { type TaskAttemptRow, rowToAttempt } from './converters.js';

export function createAttempt(db: Database.Database, attempt: TaskAttempt): TaskAttempt {
  const stmt = db.prepare(`
    INSERT INTO task_attempts (
      attempt_id, task_id, attempt_number, started_at, ended_at,
      outcome, error, agent_id, audit_findings
    )
    VALUES (
      @attempt_id, @task_id, @attempt_number, @started_at, @ended_at,
      @outcome, @error, @agent_id, @audit_findings
    )
  `);
  stmt.run({
    attempt_id: attempt.attempt_id,
    task_id: attempt.task_id,
    attempt_number: attempt.attempt_number,
    started_at: attempt.started_at,
    ended_at: attempt.ended_at ?? null,
    outcome: attempt.outcome ?? null,
    error: attempt.error ?? null,
    agent_id: attempt.agent_id ?? null,
    audit_findings: attempt.audit_findings
      ? JSON.stringify(attempt.audit_findings)
      : null,
  });
  return attempt;
}

export function getAttempt(db: Database.Database, attemptId: string): TaskAttempt | null {
  const stmt = db.prepare<string, TaskAttemptRow>(`
    SELECT attempt_id, task_id, attempt_number, started_at, ended_at,
           outcome, error, agent_id, audit_findings
    FROM task_attempts
    WHERE attempt_id = ?
  `);
  const row = stmt.get(attemptId);
  if (!row) return null;
  return rowToAttempt(row);
}

export function updateAttempt(db: Database.Database, attemptId: string, updates: Partial<TaskAttempt>): TaskAttempt | null {
  const fields: string[] = [];
  const values: Record<string, unknown> = { attempt_id: attemptId };

  if (updates.ended_at !== undefined) {
    fields.push('ended_at = @ended_at');
    values.ended_at = updates.ended_at ?? null;
  }
  if (updates.outcome !== undefined) {
    fields.push('outcome = @outcome');
    values.outcome = updates.outcome ?? null;
  }
  if (updates.error !== undefined) {
    fields.push('error = @error');
    values.error = updates.error ?? null;
  }
  if (updates.agent_id !== undefined) {
    fields.push('agent_id = @agent_id');
    values.agent_id = updates.agent_id ?? null;
  }
  if (updates.audit_findings !== undefined) {
    fields.push('audit_findings = @audit_findings');
    values.audit_findings = updates.audit_findings
      ? JSON.stringify(updates.audit_findings)
      : null;
  }

  if (fields.length === 0) {
    return getAttempt(db, attemptId);
  }

  const stmt = db.prepare(`
    UPDATE task_attempts
    SET ${fields.join(', ')}
    WHERE attempt_id = @attempt_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getAttempt(db, attemptId);
}

export function listAttemptsByTask(db: Database.Database, taskId: string): TaskAttempt[] {
  const stmt = db.prepare<string, TaskAttemptRow>(`
    SELECT attempt_id, task_id, attempt_number, started_at, ended_at,
           outcome, error, agent_id, audit_findings
    FROM task_attempts
    WHERE task_id = ?
    ORDER BY attempt_number ASC
  `);
  const rows = stmt.all(taskId);
  return rows.map((row) => rowToAttempt(row));
}
