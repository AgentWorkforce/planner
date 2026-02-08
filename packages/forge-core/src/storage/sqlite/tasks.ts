import type Database from 'better-sqlite3';
import type { Task, TaskStatus } from '../../domain/types.js';
import { type TaskRow, rowToTask } from './converters.js';
import { getRun } from './runs.js';

export function createTask(db: Database.Database, task: Task): Task {
  const stmt = db.prepare(`
    INSERT INTO tasks (
      task_id, run_id, step_id, step_title, status, dependencies,
      scope, owner_role, step_description, acceptance_criteria,
      workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
    )
    VALUES (
      @task_id, @run_id, @step_id, @step_title, @status, @dependencies,
      @scope, @owner_role, @step_description, @acceptance_criteria,
      @workspace_path, @agent_id, @current_attempt, @gate_id, @created_at, @updated_at
    )
  `);
  stmt.run({
    task_id: task.task_id,
    run_id: task.run_id,
    step_id: task.step_id,
    step_title: task.step_title,
    status: task.status,
    dependencies: JSON.stringify(task.dependencies),
    scope: task.scope ?? null,
    owner_role: task.owner_role ?? null,
    step_description: task.step_description ?? null,
    acceptance_criteria: task.acceptance_criteria ? JSON.stringify(task.acceptance_criteria) : null,
    workspace_path: task.workspace_path ?? null,
    agent_id: task.agent_id ?? null,
    current_attempt: task.current_attempt ?? null,
    gate_id: task.gate_id ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at,
  });
  return task;
}

export function getTask(db: Database.Database, taskId: string): Task | null {
  const stmt = db.prepare<string, TaskRow>(`
    SELECT task_id, run_id, step_id, step_title, status, dependencies,
           scope, owner_role, step_description, acceptance_criteria,
           workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
    FROM tasks
    WHERE task_id = ?
  `);
  const row = stmt.get(taskId);
  if (!row) return null;
  return rowToTask(row);
}

export function updateTask(db: Database.Database, taskId: string, updates: Partial<Task>): Task | null {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = @updated_at'];
  const values: Record<string, unknown> = { task_id: taskId, updated_at: now };

  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.scope !== undefined) {
    fields.push('scope = @scope');
    values.scope = updates.scope ?? null;
  }
  if (updates.owner_role !== undefined) {
    fields.push('owner_role = @owner_role');
    values.owner_role = updates.owner_role ?? null;
  }
  if (updates.workspace_path !== undefined) {
    fields.push('workspace_path = @workspace_path');
    values.workspace_path = updates.workspace_path ?? null;
  }
  if (updates.agent_id !== undefined) {
    fields.push('agent_id = @agent_id');
    values.agent_id = updates.agent_id ?? null;
  }
  if (updates.current_attempt !== undefined) {
    fields.push('current_attempt = @current_attempt');
    values.current_attempt = updates.current_attempt ?? null;
  }
  if (updates.gate_id !== undefined) {
    fields.push('gate_id = @gate_id');
    values.gate_id = updates.gate_id ?? null;
  }
  if (updates.dependencies !== undefined) {
    fields.push('dependencies = @dependencies');
    values.dependencies = JSON.stringify(updates.dependencies);
  }

  const stmt = db.prepare(`
    UPDATE tasks
    SET ${fields.join(', ')}
    WHERE task_id = @task_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getTask(db, taskId);
}

export function updateTaskStatus(db: Database.Database, taskId: string, status: TaskStatus): Task | null {
  return updateTask(db, taskId, { status });
}

export function listTasksByRun(db: Database.Database, runId: string): Task[] {
  const stmt = db.prepare<string, TaskRow>(`
    SELECT task_id, run_id, step_id, step_title, status, dependencies,
           scope, owner_role, step_description, acceptance_criteria,
           workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
    FROM tasks
    WHERE run_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToTask(row));
}

export function getReadyTasks(db: Database.Database, runId: string): Task[] {
  // Get all tasks for the run
  const allTasks = listTasksByRun(db, runId);

  // Get run to check has_pending_gate
  const run = getRun(db, runId);
  if (!run || run.has_pending_gate) {
    return [];
  }

  // Find tasks that are pending and have all dependencies completed
  const completedStepIds = new Set(
    allTasks.filter((t) => t.status === 'completed').map((t) => t.step_id)
  );

  return allTasks.filter((task) => {
    if (task.status !== 'pending') return false;

    // Check if all dependencies are completed
    return task.dependencies.every((depStepId) => completedStepIds.has(depStepId));
  });
}

export function getTaskByStepId(db: Database.Database, runId: string, stepId: string): Task | null {
  const stmt = db.prepare<[string, string], TaskRow>(`
    SELECT task_id, run_id, step_id, step_title, status, dependencies,
           scope, owner_role, step_description, acceptance_criteria,
           workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
    FROM tasks
    WHERE run_id = ? AND step_id = ?
  `);
  const row = stmt.get(runId, stepId);
  if (!row) return null;
  return rowToTask(row);
}
