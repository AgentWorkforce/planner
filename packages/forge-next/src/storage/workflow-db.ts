/**
 * ForgeNextWorkflowDb — SQLite-backed implementation of the relay SDK's
 * WorkflowDb interface.
 *
 * The relay WorkflowRunner requires an async WorkflowDb. better-sqlite3 is
 * synchronous, so we wrap each operation in Promise.resolve() to satisfy the
 * interface contract without spawning threads.
 *
 * Tables (workflow_runs, workflow_steps) are created by initSchema() in
 * schema.ts, which SqliteForgeNextStorage already calls.
 */

import type { WorkflowDb } from '@agent-relay/sdk/workflows';
import type { WorkflowRunRow, WorkflowStepRow } from '@agent-relay/sdk/workflows';
import type Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Raw DB row shapes
// ---------------------------------------------------------------------------

interface WorkflowRunDbRow {
  id: string;
  workspace_id: string;
  workflow_name: string;
  pattern: string;
  status: string;
  config: string;
  state_snapshot: string | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowStepDbRow {
  id: string;
  run_id: string;
  step_name: string;
  agent_name: string | null;
  step_type: string;
  status: string;
  task: string;
  depends_on: string;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToRunRow(row: WorkflowRunDbRow): WorkflowRunRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workflowName: row.workflow_name,
    pattern: row.pattern as WorkflowRunRow['pattern'],
    status: row.status as WorkflowRunRow['status'],
    config: JSON.parse(row.config) as WorkflowRunRow['config'],
    stateSnapshot: row.state_snapshot
      ? (JSON.parse(row.state_snapshot) as Record<string, unknown>)
      : undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStepRow(row: WorkflowStepDbRow): WorkflowStepRow {
  return {
    id: row.id,
    runId: row.run_id,
    stepName: row.step_name,
    agentName: row.agent_name,
    stepType: row.step_type as WorkflowStepRow['stepType'],
    status: row.status as WorkflowStepRow['status'],
    task: row.task,
    dependsOn: JSON.parse(row.depends_on) as string[],
    output: row.output ?? undefined,
    error: row.error ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class ForgeNextWorkflowDb implements WorkflowDb {
  constructor(private readonly db: Database.Database) {}

  async insertRun(run: WorkflowRunRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO workflow_runs
         (id, workspace_id, workflow_name, pattern, status, config, state_snapshot,
          started_at, completed_at, error, created_at, updated_at)
         VALUES
         (@id, @workspaceId, @workflowName, @pattern, @status, @config, @stateSnapshot,
          @startedAt, @completedAt, @error, @createdAt, @updatedAt)`,
      )
      .run({
        id: run.id,
        workspaceId: run.workspaceId,
        workflowName: run.workflowName,
        pattern: run.pattern,
        status: run.status,
        config: JSON.stringify(run.config),
        stateSnapshot: run.stateSnapshot ? JSON.stringify(run.stateSnapshot) : null,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
        error: run.error ?? null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      });
  }

  async updateRun(id: string, patch: Partial<WorkflowRunRow>): Promise<void> {
    // Map camelCase domain fields to snake_case column names
    const columnMap: Record<string, string> = {
      workspaceId: 'workspace_id',
      workflowName: 'workflow_name',
      stateSnapshot: 'state_snapshot',
      startedAt: 'started_at',
      completedAt: 'completed_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const params: Record<string, unknown> = { id };
    const setClauses: string[] = [];

    for (const [key, value] of Object.entries(patch)) {
      const col = columnMap[key] ?? key;
      const paramKey = col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      params[paramKey] = key === 'config'
        ? JSON.stringify(value)
        : key === 'stateSnapshot' && value != null
          ? JSON.stringify(value)
          : (value ?? null);
      setClauses.push(`${col} = @${paramKey}`);
    }

    if (setClauses.length === 0) return;

    this.db
      .prepare(`UPDATE workflow_runs SET ${setClauses.join(', ')} WHERE id = @id`)
      .run(params);
  }

  async getRun(id: string): Promise<WorkflowRunRow | null> {
    const row = this.db
      .prepare<[string], WorkflowRunDbRow>(`SELECT * FROM workflow_runs WHERE id = ?`)
      .get(id);
    return row ? rowToRunRow(row) : null;
  }

  async insertStep(step: WorkflowStepRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO workflow_steps
         (id, run_id, step_name, agent_name, step_type, status, task, depends_on,
          output, error, started_at, completed_at, retry_count, created_at, updated_at)
         VALUES
         (@id, @runId, @stepName, @agentName, @stepType, @status, @task, @dependsOn,
          @output, @error, @startedAt, @completedAt, @retryCount, @createdAt, @updatedAt)`,
      )
      .run({
        id: step.id,
        runId: step.runId,
        stepName: step.stepName,
        agentName: step.agentName ?? null,
        stepType: step.stepType,
        status: step.status,
        task: step.task,
        dependsOn: JSON.stringify(step.dependsOn),
        output: step.output ?? null,
        error: step.error ?? null,
        startedAt: step.startedAt ?? null,
        completedAt: step.completedAt ?? null,
        retryCount: step.retryCount,
        createdAt: step.createdAt,
        updatedAt: step.updatedAt,
      });
  }

  async updateStep(id: string, patch: Partial<WorkflowStepRow>): Promise<void> {
    const columnMap: Record<string, string> = {
      runId: 'run_id',
      stepName: 'step_name',
      agentName: 'agent_name',
      stepType: 'step_type',
      dependsOn: 'depends_on',
      startedAt: 'started_at',
      completedAt: 'completed_at',
      retryCount: 'retry_count',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const params: Record<string, unknown> = { id };
    const setClauses: string[] = [];

    for (const [key, value] of Object.entries(patch)) {
      const col = columnMap[key] ?? key;
      const paramKey = col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      params[paramKey] = key === 'dependsOn' && Array.isArray(value)
        ? JSON.stringify(value)
        : (value ?? null);
      setClauses.push(`${col} = @${paramKey}`);
    }

    if (setClauses.length === 0) return;

    this.db
      .prepare(`UPDATE workflow_steps SET ${setClauses.join(', ')} WHERE id = @id`)
      .run(params);
  }

  async getStepsByRunId(runId: string): Promise<WorkflowStepRow[]> {
    const rows = this.db
      .prepare<[string], WorkflowStepDbRow>(
        `SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY created_at ASC`,
      )
      .all(runId);
    return rows.map(rowToStepRow);
  }
}
