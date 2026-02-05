import Database from 'better-sqlite3';
import type {
  Run,
  RunStatus,
  Task,
  TaskStatus,
  TaskAttempt,
  Artifact,
  ArtifactType,
  Gate,
  GateStatus,
  Question,
  QuestionStatus,
  QuestionBlockingLevel,
  Checkpoint,
  TaskSnapshot,
  TrajectoryEvent,
  WorkspaceCleanup,
  AuditFinding,
  AttemptOutcome,
  GuardianEvent,
  GuardianConcernLevel,
  ActiveGuardian,
  GuardianStatus,
  TaskExecutionMetric,
} from '../domain/types.js';
import type {
  UserTrajectoryEvent,
  UserTrajectoryScope,
  DerivedPreference,
} from '../domain/user-trajectory.js';
import type { ForgeStorage, TrajectoryEventFilter, GuardianEventFilter } from './interface.js';
import { ALL_SCHEMA_STATEMENTS } from './schema.js';

// ============================================
// Safe JSON Parsing
// ============================================

/**
 * Safely parse JSON with a default fallback value.
 * Logs warning on parse failure but doesn't throw.
 */
function safeJsonParse<T>(json: string | null | undefined, defaultValue: T, context?: string): T {
  if (json === null || json === undefined) {
    return defaultValue;
  }
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    const contextInfo = context ? ` (${context})` : '';
    console.warn(`[SqliteStorage] Failed to parse JSON${contextInfo}:`, err);
    return defaultValue;
  }
}

// ============================================
// Row types for database queries
// ============================================

interface RunRow {
  run_id: string;
  plan_id: string;
  plan_version: number;
  status: string;
  has_pending_gate: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  document: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  task_id: string;
  run_id: string;
  step_id: string;
  step_title: string;
  status: string;
  dependencies: string;
  scope: string | null;
  owner_role: string | null;
  workspace_path: string | null;
  agent_id: string | null;
  current_attempt: number | null;
  gate_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskAttemptRow {
  attempt_id: string;
  task_id: string;
  attempt_number: number;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
  error: string | null;
  agent_id: string | null;
  audit_findings: string | null;
}

interface ArtifactRow {
  artifact_id: string;
  task_id: string;
  type: string;
  reference: string;
  metadata: string | null;
  created_at: string;
}

interface GateRow {
  gate_id: string;
  task_id: string;
  status: string;
  approver_role: string | null;
  decided_by: string | null;
  decided_at: string | null;
  comment: string | null;
  created_at: string;
}

interface WorkspaceCleanupRow {
  task_id: string;
  cleanup_after: string;
}

interface CheckpointRow {
  checkpoint_id: string;
  run_id: string;
  run_status: string;
  has_pending_gate: number;
  tasks_snapshot: string;
  active_agents: string;
  snapshot: string;
  created_at: string;
}

interface TrajectoryEventRow {
  event_id: string;
  run_id: string;
  task_id: string | null;
  event_type: string;
  payload: string;
  timestamp: string;
}

interface QuestionRow {
  question_id: string;
  run_id: string;
  task_id: string | null;
  agent_id: string;
  text: string;
  options: string | null;
  blocking_level: string;
  steps_blocked: number;
  cascade_depth: number;
  can_use_default: number;
  default_value: string | null;
  subscribers: string;
  status: string;
  answer: string | null;
  answered_by: string | null;
  priority_score: number;
  created_at: string;
  answered_at: string | null;
}

interface GuardianEventRow {
  event_id: string;
  project_id: string;
  guardian_type: string;
  observation: string;
  concern_level: string;
  recommendation: string | null;
  timestamp: string;
  run_id: string | null;
  task_id: string | null;
  worker_agent_id: string | null;
  trigger_type: string | null;
  intervention_taken: string | null;
}

interface ActiveGuardianRow {
  guardian_id: string;
  project_id: string;
  guardian_type: string;
  agent_name: string;
  status: string;
  shadow_targets: string;
  speak_on: string;
  spawned_at: string;
  stopped_at: string | null;
  error: string | null;
}

interface UserTrajectoryEventRow {
  event_id: string;
  user_id: string;
  scope: string;
  question_text: string;
  selected_option: string;
  reasoning: string | null;
  run_id: string | null;
  task_id: string | null;
  project_id: string | null;
  category: string | null;
  timestamp: string;
}

interface DerivedPreferenceRow {
  preference_id: string;
  user_id: string;
  scope: string;
  project_id: string | null;
  run_id: string | null;
  category: string;
  value: string;
  confidence: number;
  evidence_count: number;
  last_expressed: string;
  is_override: number;
  created_at: string;
  updated_at: string;
}

interface TaskExecutionMetricRow {
  metric_id: string;
  task_id: string;
  run_id: string;
  model_id: string | null;
  complexity_score: number | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  outcome: string | null;
  confidence: number | null;
  created_at: string;
}

interface RunBudgetRow {
  run_id: string;
  tokens_allowed: number | null;
  tokens_used: number;
  cost_allowed_usd: number | null;
  cost_used_usd: number;
  updated_at: string;
}

// ============================================
// SQLite Storage Implementation
// ============================================

/**
 * SQLite implementation of ForgeStorage.
 */
export class SqliteForgeStorage implements ForgeStorage {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  /**
   * Initialize database schema.
   */
  private initialize(): void {
    for (const statement of ALL_SCHEMA_STATEMENTS) {
      this.db.exec(statement);
    }
  }

  // ============================================
  // Run operations
  // ============================================

  createRun(run: Run): Run {
    const stmt = this.db.prepare(`
      INSERT INTO runs (
        run_id, plan_id, plan_version, status, has_pending_gate,
        started_at, completed_at, error, document, created_at, updated_at
      )
      VALUES (
        @run_id, @plan_id, @plan_version, @status, @has_pending_gate,
        @started_at, @completed_at, @error, @document, @created_at, @updated_at
      )
    `);
    stmt.run({
      run_id: run.run_id,
      plan_id: run.plan_id,
      plan_version: run.plan_version,
      status: run.status,
      has_pending_gate: run.has_pending_gate ? 1 : 0,
      started_at: run.started_at ?? null,
      completed_at: run.completed_at ?? null,
      error: run.error ?? null,
      document: null, // Can be populated separately if needed
      created_at: run.created_at,
      updated_at: run.updated_at,
    });
    return run;
  }

  getRun(runId: string): Run | null {
    const stmt = this.db.prepare<string, RunRow>(`
      SELECT run_id, plan_id, plan_version, status, has_pending_gate,
             started_at, completed_at, error, document, created_at, updated_at
      FROM runs
      WHERE run_id = ?
    `);
    const row = stmt.get(runId);
    if (!row) return null;
    return this.rowToRun(row);
  }

  updateRun(runId: string, updates: Partial<Run>): Run | null {
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

    const stmt = this.db.prepare(`
      UPDATE runs
      SET ${fields.join(', ')}
      WHERE run_id = @run_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getRun(runId);
  }

  updateRunStatus(runId: string, status: RunStatus): Run | null {
    return this.updateRun(runId, { status });
  }

  updateRunGateFlag(runId: string, hasPendingGate: boolean): Run | null {
    return this.updateRun(runId, { has_pending_gate: hasPendingGate });
  }

  listRuns(status?: RunStatus): Run[] {
    let sql = `
      SELECT run_id, plan_id, plan_version, status, has_pending_gate,
             started_at, completed_at, error, document, created_at, updated_at
      FROM runs
    `;
    const params: unknown[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare<unknown[], RunRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToRun(row));
  }

  getActiveRuns(): Run[] {
    const stmt = this.db.prepare<[], RunRow>(`
      SELECT run_id, plan_id, plan_version, status, has_pending_gate,
             started_at, completed_at, error, document, created_at, updated_at
      FROM runs
      WHERE status IN ('running', 'paused')
      ORDER BY created_at ASC
    `);
    const rows = stmt.all();
    return rows.map((row) => this.rowToRun(row));
  }

  // ============================================
  // Task operations
  // ============================================

  createTask(task: Task): Task {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        task_id, run_id, step_id, step_title, status, dependencies,
        scope, owner_role, workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
      )
      VALUES (
        @task_id, @run_id, @step_id, @step_title, @status, @dependencies,
        @scope, @owner_role, @workspace_path, @agent_id, @current_attempt, @gate_id, @created_at, @updated_at
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
      workspace_path: task.workspace_path ?? null,
      agent_id: task.agent_id ?? null,
      current_attempt: task.current_attempt ?? null,
      gate_id: task.gate_id ?? null,
      created_at: task.created_at,
      updated_at: task.updated_at,
    });
    return task;
  }

  getTask(taskId: string): Task | null {
    const stmt = this.db.prepare<string, TaskRow>(`
      SELECT task_id, run_id, step_id, step_title, status, dependencies,
             scope, owner_role, workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
      FROM tasks
      WHERE task_id = ?
    `);
    const row = stmt.get(taskId);
    if (!row) return null;
    return this.rowToTask(row);
  }

  updateTask(taskId: string, updates: Partial<Task>): Task | null {
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

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE task_id = @task_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getTask(taskId);
  }

  updateTaskStatus(taskId: string, status: TaskStatus): Task | null {
    return this.updateTask(taskId, { status });
  }

  listTasksByRun(runId: string): Task[] {
    const stmt = this.db.prepare<string, TaskRow>(`
      SELECT task_id, run_id, step_id, step_title, status, dependencies,
             scope, owner_role, workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
      FROM tasks
      WHERE run_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToTask(row));
  }

  getReadyTasks(runId: string): Task[] {
    // Get all tasks for the run
    const allTasks = this.listTasksByRun(runId);

    // Get run to check has_pending_gate
    const run = this.getRun(runId);
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

  getTaskByStepId(runId: string, stepId: string): Task | null {
    const stmt = this.db.prepare<[string, string], TaskRow>(`
      SELECT task_id, run_id, step_id, step_title, status, dependencies,
             scope, owner_role, workspace_path, agent_id, current_attempt, gate_id, created_at, updated_at
      FROM tasks
      WHERE run_id = ? AND step_id = ?
    `);
    const row = stmt.get(runId, stepId);
    if (!row) return null;
    return this.rowToTask(row);
  }

  // ============================================
  // TaskAttempt operations
  // ============================================

  createAttempt(attempt: TaskAttempt): TaskAttempt {
    const stmt = this.db.prepare(`
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

  getAttempt(attemptId: string): TaskAttempt | null {
    const stmt = this.db.prepare<string, TaskAttemptRow>(`
      SELECT attempt_id, task_id, attempt_number, started_at, ended_at,
             outcome, error, agent_id, audit_findings
      FROM task_attempts
      WHERE attempt_id = ?
    `);
    const row = stmt.get(attemptId);
    if (!row) return null;
    return this.rowToAttempt(row);
  }

  updateAttempt(attemptId: string, updates: Partial<TaskAttempt>): TaskAttempt | null {
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
      return this.getAttempt(attemptId);
    }

    const stmt = this.db.prepare(`
      UPDATE task_attempts
      SET ${fields.join(', ')}
      WHERE attempt_id = @attempt_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getAttempt(attemptId);
  }

  listAttemptsByTask(taskId: string): TaskAttempt[] {
    const stmt = this.db.prepare<string, TaskAttemptRow>(`
      SELECT attempt_id, task_id, attempt_number, started_at, ended_at,
             outcome, error, agent_id, audit_findings
      FROM task_attempts
      WHERE task_id = ?
      ORDER BY attempt_number ASC
    `);
    const rows = stmt.all(taskId);
    return rows.map((row) => this.rowToAttempt(row));
  }

  // ============================================
  // Artifact operations
  // ============================================

  createArtifact(artifact: Artifact): Artifact {
    const stmt = this.db.prepare(`
      INSERT INTO artifacts (artifact_id, task_id, type, reference, metadata, created_at)
      VALUES (@artifact_id, @task_id, @type, @reference, @metadata, @created_at)
    `);
    stmt.run({
      artifact_id: artifact.artifact_id,
      task_id: artifact.task_id,
      type: artifact.type,
      reference: artifact.reference,
      metadata: artifact.metadata ? JSON.stringify(artifact.metadata) : null,
      created_at: artifact.created_at,
    });
    return artifact;
  }

  listArtifactsByTask(taskId: string): Artifact[] {
    const stmt = this.db.prepare<string, ArtifactRow>(`
      SELECT artifact_id, task_id, type, reference, metadata, created_at
      FROM artifacts
      WHERE task_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(taskId);
    return rows.map((row) => this.rowToArtifact(row));
  }

  listArtifactsByRun(runId: string): Artifact[] {
    const stmt = this.db.prepare<string, ArtifactRow>(`
      SELECT a.artifact_id, a.task_id, a.type, a.reference, a.metadata, a.created_at
      FROM artifacts a
      INNER JOIN tasks t ON a.task_id = t.task_id
      WHERE t.run_id = ?
      ORDER BY a.created_at ASC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToArtifact(row));
  }

  // ============================================
  // Gate operations
  // ============================================

  createGate(gate: Gate): Gate {
    const stmt = this.db.prepare(`
      INSERT INTO gates (
        gate_id, task_id, status, approver_role, decided_by, decided_at, comment, created_at
      )
      VALUES (
        @gate_id, @task_id, @status, @approver_role, @decided_by, @decided_at, @comment, @created_at
      )
    `);
    stmt.run({
      gate_id: gate.gate_id,
      task_id: gate.task_id,
      status: gate.status,
      approver_role: gate.approver_role ?? null,
      decided_by: gate.decided_by ?? null,
      decided_at: gate.decided_at ?? null,
      comment: gate.comment ?? null,
      created_at: gate.created_at,
    });
    return gate;
  }

  getGate(gateId: string): Gate | null {
    const stmt = this.db.prepare<string, GateRow>(`
      SELECT gate_id, task_id, status, approver_role, decided_by, decided_at, comment, created_at
      FROM gates
      WHERE gate_id = ?
    `);
    const row = stmt.get(gateId);
    if (!row) return null;
    return this.rowToGate(row);
  }

  getGateByTaskId(taskId: string): Gate | null {
    const stmt = this.db.prepare<string, GateRow>(`
      SELECT gate_id, task_id, status, approver_role, decided_by, decided_at, comment, created_at
      FROM gates
      WHERE task_id = ?
    `);
    const row = stmt.get(taskId);
    if (!row) return null;
    return this.rowToGate(row);
  }

  updateGate(gateId: string, updates: Partial<Gate>): Gate | null {
    const fields: string[] = [];
    const values: Record<string, unknown> = { gate_id: gateId };

    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.decided_by !== undefined) {
      fields.push('decided_by = @decided_by');
      values.decided_by = updates.decided_by ?? null;
    }
    if (updates.decided_at !== undefined) {
      fields.push('decided_at = @decided_at');
      values.decided_at = updates.decided_at ?? null;
    }
    if (updates.comment !== undefined) {
      fields.push('comment = @comment');
      values.comment = updates.comment ?? null;
    }

    if (fields.length === 0) {
      return this.getGate(gateId);
    }

    const stmt = this.db.prepare(`
      UPDATE gates
      SET ${fields.join(', ')}
      WHERE gate_id = @gate_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getGate(gateId);
  }

  updateGateDecision(
    gateId: string,
    status: GateStatus,
    decidedBy: string,
    comment?: string
  ): Gate | null {
    const now = new Date().toISOString();
    return this.updateGate(gateId, {
      status,
      decided_by: decidedBy,
      decided_at: now,
      comment,
    });
  }

  listPendingGates(runId: string): Gate[] {
    const stmt = this.db.prepare<string, GateRow>(`
      SELECT g.gate_id, g.task_id, g.status, g.approver_role, g.decided_by, g.decided_at, g.comment, g.created_at
      FROM gates g
      INNER JOIN tasks t ON g.task_id = t.task_id
      WHERE t.run_id = ? AND g.status = 'pending'
      ORDER BY g.created_at ASC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToGate(row));
  }

  // ============================================
  // Workspace cleanup operations
  // ============================================

  scheduleCleanup(taskId: string, cleanupAfter: string): WorkspaceCleanup {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspace_cleanup (task_id, cleanup_after)
      VALUES (@task_id, @cleanup_after)
    `);
    stmt.run({ task_id: taskId, cleanup_after: cleanupAfter });
    return { task_id: taskId, cleanup_after: cleanupAfter };
  }

  getExpiredCleanups(): WorkspaceCleanup[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare<string, WorkspaceCleanupRow>(`
      SELECT task_id, cleanup_after
      FROM workspace_cleanup
      WHERE cleanup_after < ?
      ORDER BY cleanup_after ASC
    `);
    const rows = stmt.all(now);
    return rows.map((row) => ({
      task_id: row.task_id,
      cleanup_after: row.cleanup_after,
    }));
  }

  deleteCleanup(taskId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM workspace_cleanup
      WHERE task_id = ?
    `);
    const result = stmt.run(taskId);
    return result.changes > 0;
  }

  // ============================================
  // Checkpoint operations
  // ============================================

  createCheckpoint(checkpoint: Checkpoint): Checkpoint {
    const stmt = this.db.prepare(`
      INSERT INTO checkpoints (
        checkpoint_id, run_id, run_status, has_pending_gate,
        tasks_snapshot, active_agents, snapshot, created_at
      )
      VALUES (
        @checkpoint_id, @run_id, @run_status, @has_pending_gate,
        @tasks_snapshot, @active_agents, @snapshot, @created_at
      )
    `);
    stmt.run({
      checkpoint_id: checkpoint.checkpoint_id,
      run_id: checkpoint.run_id,
      run_status: checkpoint.run_status,
      has_pending_gate: checkpoint.has_pending_gate ? 1 : 0,
      tasks_snapshot: JSON.stringify(checkpoint.tasks_snapshot),
      active_agents: JSON.stringify(checkpoint.active_agents),
      snapshot: JSON.stringify(checkpoint.snapshot),
      created_at: checkpoint.created_at,
    });
    return checkpoint;
  }

  getLatestCheckpoint(runId: string): Checkpoint | null {
    const stmt = this.db.prepare<string, CheckpointRow>(`
      SELECT checkpoint_id, run_id, run_status, has_pending_gate,
             tasks_snapshot, active_agents, snapshot, created_at
      FROM checkpoints
      WHERE run_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(runId);
    if (!row) return null;
    return this.rowToCheckpoint(row);
  }

  listCheckpoints(runId: string): Checkpoint[] {
    const stmt = this.db.prepare<string, CheckpointRow>(`
      SELECT checkpoint_id, run_id, run_status, has_pending_gate,
             tasks_snapshot, active_agents, snapshot, created_at
      FROM checkpoints
      WHERE run_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToCheckpoint(row));
  }

  // ============================================
  // Trajectory Event operations
  // ============================================

  createTrajectoryEvent(event: TrajectoryEvent): TrajectoryEvent {
    const stmt = this.db.prepare(`
      INSERT INTO trajectory_events (event_id, run_id, task_id, event_type, payload, timestamp)
      VALUES (@event_id, @run_id, @task_id, @event_type, @payload, @timestamp)
    `);
    stmt.run({
      event_id: event.event_id,
      run_id: event.run_id,
      task_id: event.task_id ?? null,
      event_type: event.event_type,
      payload: JSON.stringify(event.payload),
      timestamp: event.timestamp,
    });
    return event;
  }

  listTrajectoryEvents(runId: string, filter?: TrajectoryEventFilter): TrajectoryEvent[] {
    let sql = `
      SELECT event_id, run_id, task_id, event_type, payload, timestamp
      FROM trajectory_events
      WHERE run_id = ?
    `;
    const params: unknown[] = [runId];

    if (filter?.task_id) {
      sql += ' AND task_id = ?';
      params.push(filter.task_id);
    }
    if (filter?.event_type) {
      sql += ' AND event_type = ?';
      params.push(filter.event_type);
    }
    if (filter?.from_timestamp) {
      sql += ' AND timestamp >= ?';
      params.push(filter.from_timestamp);
    }
    if (filter?.to_timestamp) {
      sql += ' AND timestamp <= ?';
      params.push(filter.to_timestamp);
    }

    sql += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare<unknown[], TrajectoryEventRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToTrajectoryEvent(row));
  }

  deleteTrajectoryEventsOlderThan(timestamp: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM trajectory_events
      WHERE timestamp < ?
    `);
    const result = stmt.run(timestamp);
    return result.changes;
  }

  deleteTrajectoryEventsByRunId(runId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM trajectory_events
      WHERE run_id = ?
    `);
    const result = stmt.run(runId);
    return result.changes;
  }

  countTrajectoryEvents(runId: string): number {
    const stmt = this.db.prepare<string, { count: number }>(`
      SELECT COUNT(*) as count
      FROM trajectory_events
      WHERE run_id = ?
    `);
    const row = stmt.get(runId);
    return row?.count ?? 0;
  }

  // ============================================
  // Question operations
  // ============================================

  createQuestion(question: Question): Question {
    const stmt = this.db.prepare(`
      INSERT INTO questions (
        question_id, run_id, task_id, agent_id, text, options,
        blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
        status, answer, answered_by, priority_score, created_at, answered_at
      )
      VALUES (
        @question_id, @run_id, @task_id, @agent_id, @text, @options,
        @blocking_level, @steps_blocked, @cascade_depth, @can_use_default, @default_value, @subscribers,
        @status, @answer, @answered_by, @priority_score, @created_at, @answered_at
      )
    `);
    stmt.run({
      question_id: question.question_id,
      run_id: question.run_id,
      task_id: question.task_id ?? null,
      agent_id: question.agent_id,
      text: question.text,
      options: question.options ? JSON.stringify(question.options) : null,
      blocking_level: question.blocking_level,
      steps_blocked: question.steps_blocked,
      cascade_depth: question.cascade_depth,
      can_use_default: question.can_use_default ? 1 : 0,
      default_value: question.default_value ?? null,
      subscribers: JSON.stringify(question.subscribers),
      status: question.status,
      answer: question.answer ?? null,
      answered_by: question.answered_by ?? null,
      priority_score: question.priority_score,
      created_at: question.created_at,
      answered_at: question.answered_at ?? null,
    });
    return question;
  }

  getQuestion(questionId: string): Question | null {
    const stmt = this.db.prepare<string, QuestionRow>(`
      SELECT question_id, run_id, task_id, agent_id, text, options,
             blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
             status, answer, answered_by, priority_score, created_at, answered_at
      FROM questions
      WHERE question_id = ?
    `);
    const row = stmt.get(questionId);
    if (!row) return null;
    return this.rowToQuestion(row);
  }

  updateQuestion(questionId: string, updates: Partial<Question>): Question | null {
    const fields: string[] = [];
    const values: Record<string, unknown> = { question_id: questionId };

    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.answer !== undefined) {
      fields.push('answer = @answer');
      values.answer = updates.answer ?? null;
    }
    if (updates.answered_by !== undefined) {
      fields.push('answered_by = @answered_by');
      values.answered_by = updates.answered_by ?? null;
    }
    if (updates.answered_at !== undefined) {
      fields.push('answered_at = @answered_at');
      values.answered_at = updates.answered_at ?? null;
    }
    if (updates.priority_score !== undefined) {
      fields.push('priority_score = @priority_score');
      values.priority_score = updates.priority_score;
    }
    if (updates.steps_blocked !== undefined) {
      fields.push('steps_blocked = @steps_blocked');
      values.steps_blocked = updates.steps_blocked;
    }
    if (updates.cascade_depth !== undefined) {
      fields.push('cascade_depth = @cascade_depth');
      values.cascade_depth = updates.cascade_depth;
    }
    if (updates.subscribers !== undefined) {
      fields.push('subscribers = @subscribers');
      values.subscribers = JSON.stringify(updates.subscribers);
    }
    if (updates.can_use_default !== undefined) {
      fields.push('can_use_default = @can_use_default');
      values.can_use_default = updates.can_use_default ? 1 : 0;
    }
    if (updates.default_value !== undefined) {
      fields.push('default_value = @default_value');
      values.default_value = updates.default_value ?? null;
    }

    if (fields.length === 0) {
      return this.getQuestion(questionId);
    }

    const stmt = this.db.prepare(`
      UPDATE questions
      SET ${fields.join(', ')}
      WHERE question_id = @question_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getQuestion(questionId);
  }

  answerQuestion(questionId: string, answer: string, answeredBy?: string): Question | null {
    const now = new Date().toISOString();
    return this.updateQuestion(questionId, {
      status: 'answered' as QuestionStatus,
      answer,
      answered_by: answeredBy,
      answered_at: now,
    });
  }

  dismissQuestion(questionId: string): Question | null {
    return this.updateQuestion(questionId, {
      status: 'dismissed' as QuestionStatus,
    });
  }

  listPendingByPriority(runId: string): Question[] {
    const stmt = this.db.prepare<string, QuestionRow>(`
      SELECT question_id, run_id, task_id, agent_id, text, options,
             blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
             status, answer, answered_by, priority_score, created_at, answered_at
      FROM questions
      WHERE run_id = ? AND status = 'pending'
      ORDER BY priority_score DESC, created_at ASC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToQuestion(row));
  }

  listQuestionsByRun(runId: string, status?: QuestionStatus): Question[] {
    let sql = `
      SELECT question_id, run_id, task_id, agent_id, text, options,
             blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
             status, answer, answered_by, priority_score, created_at, answered_at
      FROM questions
      WHERE run_id = ?
    `;
    const params: unknown[] = [runId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY priority_score DESC, created_at ASC';

    const stmt = this.db.prepare<unknown[], QuestionRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToQuestion(row));
  }

  // ============================================
  // User Trajectory Event operations
  // ============================================

  createUserTrajectoryEvent(event: UserTrajectoryEvent): UserTrajectoryEvent {
    const stmt = this.db.prepare(`
      INSERT INTO user_trajectory_events (
        event_id, user_id, scope, question_text, selected_option, reasoning,
        run_id, task_id, project_id, category, timestamp
      )
      VALUES (
        @event_id, @user_id, @scope, @question_text, @selected_option, @reasoning,
        @run_id, @task_id, @project_id, @category, @timestamp
      )
    `);
    stmt.run({
      event_id: event.event_id,
      user_id: event.user_id,
      scope: event.scope,
      question_text: event.question_text,
      selected_option: event.selected_option,
      reasoning: event.reasoning ?? null,
      run_id: event.run_id ?? null,
      task_id: event.task_id ?? null,
      project_id: event.project_id ?? null,
      category: event.category ?? null,
      timestamp: event.timestamp,
    });
    return event;
  }

  listUserTrajectoryEvents(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): UserTrajectoryEvent[] {
    let sql = `
      SELECT event_id, user_id, scope, question_text, selected_option, reasoning,
             run_id, task_id, project_id, category, timestamp
      FROM user_trajectory_events
      WHERE user_id = ?
    `;
    const params: unknown[] = [userId];

    if (scope) {
      sql += ' AND scope = ?';
      params.push(scope);
    }
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    if (runId) {
      sql += ' AND run_id = ?';
      params.push(runId);
    }

    sql += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare<unknown[], UserTrajectoryEventRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToUserTrajectoryEvent(row));
  }

  getUserTrajectoryEventsByCategory(
    userId: string,
    category: string,
    scope?: UserTrajectoryScope
  ): UserTrajectoryEvent[] {
    let sql = `
      SELECT event_id, user_id, scope, question_text, selected_option, reasoning,
             run_id, task_id, project_id, category, timestamp
      FROM user_trajectory_events
      WHERE user_id = ? AND category = ?
    `;
    const params: unknown[] = [userId, category];

    if (scope) {
      sql += ' AND scope = ?';
      params.push(scope);
    }

    sql += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare<unknown[], UserTrajectoryEventRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToUserTrajectoryEvent(row));
  }

  searchSimilarUserTrajectoryEvents(
    userId: string,
    questionText: string,
    scope?: UserTrajectoryScope,
    limit: number = 10
  ): UserTrajectoryEvent[] {
    // Simple text search - fetch all events and filter
    // For production, consider using FTS5 or external similarity service
    let sql = `
      SELECT event_id, user_id, scope, question_text, selected_option, reasoning,
             run_id, task_id, project_id, category, timestamp
      FROM user_trajectory_events
      WHERE user_id = ?
    `;
    const params: unknown[] = [userId];

    if (scope) {
      sql += ' AND scope = ?';
      params.push(scope);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit * 10); // Fetch more to filter

    const stmt = this.db.prepare<unknown[], UserTrajectoryEventRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToUserTrajectoryEvent(row)).slice(0, limit);
  }

  // ============================================
  // User Preference operations
  // ============================================

  createPreference(preference: DerivedPreference): DerivedPreference {
    const stmt = this.db.prepare(`
      INSERT INTO user_preferences (
        preference_id, user_id, scope, project_id, run_id, category, value,
        confidence, evidence_count, last_expressed, is_override, created_at, updated_at
      )
      VALUES (
        @preference_id, @user_id, @scope, @project_id, @run_id, @category, @value,
        @confidence, @evidence_count, @last_expressed, @is_override, @created_at, @updated_at
      )
    `);
    stmt.run({
      preference_id: preference.preference_id,
      user_id: preference.user_id,
      scope: preference.scope,
      project_id: preference.project_id ?? null,
      run_id: preference.run_id ?? null,
      category: preference.category,
      value: preference.value,
      confidence: preference.confidence,
      evidence_count: preference.evidence_count,
      last_expressed: preference.last_expressed,
      is_override: preference.is_override ? 1 : 0,
      created_at: preference.created_at,
      updated_at: preference.updated_at,
    });
    return preference;
  }

  getPreference(
    userId: string,
    scope: UserTrajectoryScope,
    category: string,
    projectId?: string,
    runId?: string
  ): DerivedPreference | null {
    let sql = `
      SELECT preference_id, user_id, scope, project_id, run_id, category, value,
             confidence, evidence_count, last_expressed, is_override, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ? AND scope = ? AND category = ?
    `;
    const params: unknown[] = [userId, scope, category];

    if (projectId !== undefined) {
      sql += ' AND (project_id = ? OR project_id IS NULL)';
      params.push(projectId);
    } else {
      sql += ' AND project_id IS NULL';
    }

    if (runId !== undefined) {
      sql += ' AND (run_id = ? OR run_id IS NULL)';
      params.push(runId);
    } else {
      sql += ' AND run_id IS NULL';
    }

    const stmt = this.db.prepare<unknown[], DerivedPreferenceRow>(sql);
    const row = stmt.get(...params);
    if (!row) return null;
    return this.rowToDerivedPreference(row);
  }

  upsertPreference(preference: DerivedPreference): DerivedPreference {
    const stmt = this.db.prepare(`
      INSERT INTO user_preferences (
        preference_id, user_id, scope, project_id, run_id, category, value,
        confidence, evidence_count, last_expressed, is_override, created_at, updated_at
      )
      VALUES (
        @preference_id, @user_id, @scope, @project_id, @run_id, @category, @value,
        @confidence, @evidence_count, @last_expressed, @is_override, @created_at, @updated_at
      )
      ON CONFLICT (user_id, scope, category, project_id, run_id)
      DO UPDATE SET
        value = @value,
        confidence = @confidence,
        evidence_count = @evidence_count,
        last_expressed = @last_expressed,
        is_override = @is_override,
        updated_at = @updated_at
    `);
    stmt.run({
      preference_id: preference.preference_id,
      user_id: preference.user_id,
      scope: preference.scope,
      project_id: preference.project_id ?? null,
      run_id: preference.run_id ?? null,
      category: preference.category,
      value: preference.value,
      confidence: preference.confidence,
      evidence_count: preference.evidence_count,
      last_expressed: preference.last_expressed,
      is_override: preference.is_override ? 1 : 0,
      created_at: preference.created_at,
      updated_at: preference.updated_at,
    });
    return preference;
  }

  listPreferences(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): DerivedPreference[] {
    let sql = `
      SELECT preference_id, user_id, scope, project_id, run_id, category, value,
             confidence, evidence_count, last_expressed, is_override, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ?
    `;
    const params: unknown[] = [userId];

    if (scope) {
      sql += ' AND scope = ?';
      params.push(scope);
    }
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    if (runId) {
      sql += ' AND run_id = ?';
      params.push(runId);
    }

    sql += ' ORDER BY confidence DESC, last_expressed DESC';

    const stmt = this.db.prepare<unknown[], DerivedPreferenceRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToDerivedPreference(row));
  }

  getPreferencesAboveThreshold(
    userId: string,
    threshold: number,
    scope?: UserTrajectoryScope
  ): DerivedPreference[] {
    let sql = `
      SELECT preference_id, user_id, scope, project_id, run_id, category, value,
             confidence, evidence_count, last_expressed, is_override, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ? AND confidence >= ?
    `;
    const params: unknown[] = [userId, threshold];

    if (scope) {
      sql += ' AND scope = ?';
      params.push(scope);
    }

    sql += ' ORDER BY confidence DESC, last_expressed DESC';

    const stmt = this.db.prepare<unknown[], DerivedPreferenceRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToDerivedPreference(row));
  }

  deletePreference(preferenceId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM user_preferences
      WHERE preference_id = ?
    `);
    const result = stmt.run(preferenceId);
    return result.changes > 0;
  }

  // ============================================
  // Guardian Event operations
  // ============================================

  createGuardianEvent(event: GuardianEvent): GuardianEvent {
    const stmt = this.db.prepare(`
      INSERT INTO guardian_trajectories (
        event_id, project_id, guardian_type, observation, concern_level,
        recommendation, timestamp, run_id, task_id, worker_agent_id,
        trigger_type, intervention_taken
      )
      VALUES (
        @event_id, @project_id, @guardian_type, @observation, @concern_level,
        @recommendation, @timestamp, @run_id, @task_id, @worker_agent_id,
        @trigger_type, @intervention_taken
      )
    `);
    stmt.run({
      event_id: event.event_id,
      project_id: event.project_id,
      guardian_type: event.guardian_type,
      observation: event.observation,
      concern_level: event.concern_level,
      recommendation: event.recommendation ?? null,
      timestamp: event.timestamp,
      run_id: event.run_id ?? null,
      task_id: event.task_id ?? null,
      worker_agent_id: event.worker_agent_id ?? null,
      trigger_type: event.trigger_type ?? null,
      intervention_taken: event.intervention_taken ?? null,
    });
    return event;
  }

  listGuardianEvents(projectId: string, filter?: GuardianEventFilter): GuardianEvent[] {
    let sql = `
      SELECT event_id, project_id, guardian_type, observation, concern_level,
             recommendation, timestamp, run_id, task_id, worker_agent_id,
             trigger_type, intervention_taken
      FROM guardian_trajectories
      WHERE project_id = ?
    `;
    const params: unknown[] = [projectId];

    if (filter?.guardian_type) {
      sql += ' AND guardian_type = ?';
      params.push(filter.guardian_type);
    }
    if (filter?.concern_level) {
      sql += ' AND concern_level = ?';
      params.push(filter.concern_level);
    }
    if (filter?.from_timestamp) {
      sql += ' AND timestamp >= ?';
      params.push(filter.from_timestamp);
    }
    if (filter?.to_timestamp) {
      sql += ' AND timestamp <= ?';
      params.push(filter.to_timestamp);
    }
    if (filter?.run_id) {
      sql += ' AND run_id = ?';
      params.push(filter.run_id);
    }
    if (filter?.task_id) {
      sql += ' AND task_id = ?';
      params.push(filter.task_id);
    }

    sql += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare<unknown[], GuardianEventRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToGuardianEvent(row));
  }

  getGuardianEventsByType(
    projectId: string,
    guardianType: 'Security' | 'Architect' | 'QA' | 'Compliance'
  ): GuardianEvent[] {
    const stmt = this.db.prepare<[string, string], GuardianEventRow>(`
      SELECT event_id, project_id, guardian_type, observation, concern_level,
             recommendation, timestamp, run_id, task_id, worker_agent_id,
             trigger_type, intervention_taken
      FROM guardian_trajectories
      WHERE project_id = ? AND guardian_type = ?
      ORDER BY timestamp DESC
    `);
    const rows = stmt.all(projectId, guardianType);
    return rows.map((row) => this.rowToGuardianEvent(row));
  }

  countGuardianEventsByConcernLevel(
    projectId: string
  ): Record<GuardianConcernLevel, number> {
    const stmt = this.db.prepare<string, { concern_level: string; count: number }>(`
      SELECT concern_level, COUNT(*) as count
      FROM guardian_trajectories
      WHERE project_id = ?
      GROUP BY concern_level
    `);
    const rows = stmt.all(projectId);

    const result: Record<GuardianConcernLevel, number> = {
      info: 0,
      warning: 0,
      critical: 0,
    };

    for (const row of rows) {
      if (row.concern_level in result) {
        result[row.concern_level as GuardianConcernLevel] = row.count;
      }
    }

    return result;
  }

  deleteGuardianEventsOlderThan(timestamp: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM guardian_trajectories
      WHERE timestamp < ?
    `);
    const result = stmt.run(timestamp);
    return result.changes;
  }

  // ============================================
  // Active Guardian operations
  // ============================================

  createActiveGuardian(guardian: ActiveGuardian): ActiveGuardian {
    const stmt = this.db.prepare(`
      INSERT INTO active_guardians (
        guardian_id, project_id, guardian_type, agent_name, status,
        shadow_targets, speak_on, spawned_at, stopped_at, error
      )
      VALUES (
        @guardian_id, @project_id, @guardian_type, @agent_name, @status,
        @shadow_targets, @speak_on, @spawned_at, @stopped_at, @error
      )
    `);
    stmt.run({
      guardian_id: guardian.guardian_id,
      project_id: guardian.project_id,
      guardian_type: guardian.guardian_type,
      agent_name: guardian.agent_name,
      status: guardian.status,
      shadow_targets: JSON.stringify(guardian.shadow_targets),
      speak_on: JSON.stringify(guardian.speak_on),
      spawned_at: guardian.spawned_at,
      stopped_at: guardian.stopped_at ?? null,
      error: guardian.error ?? null,
    });
    return guardian;
  }

  getActiveGuardian(guardianId: string): ActiveGuardian | null {
    const stmt = this.db.prepare<string, ActiveGuardianRow>(`
      SELECT guardian_id, project_id, guardian_type, agent_name, status,
             shadow_targets, speak_on, spawned_at, stopped_at, error
      FROM active_guardians
      WHERE guardian_id = ?
    `);
    const row = stmt.get(guardianId);
    if (!row) return null;
    return this.rowToActiveGuardian(row);
  }

  updateActiveGuardian(
    guardianId: string,
    updates: Partial<ActiveGuardian>
  ): ActiveGuardian | null {
    const fields: string[] = [];
    const values: Record<string, unknown> = { guardian_id: guardianId };

    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.shadow_targets !== undefined) {
      fields.push('shadow_targets = @shadow_targets');
      values.shadow_targets = JSON.stringify(updates.shadow_targets);
    }
    if (updates.speak_on !== undefined) {
      fields.push('speak_on = @speak_on');
      values.speak_on = JSON.stringify(updates.speak_on);
    }
    if (updates.stopped_at !== undefined) {
      fields.push('stopped_at = @stopped_at');
      values.stopped_at = updates.stopped_at ?? null;
    }
    if (updates.error !== undefined) {
      fields.push('error = @error');
      values.error = updates.error ?? null;
    }

    if (fields.length === 0) {
      return this.getActiveGuardian(guardianId);
    }

    const stmt = this.db.prepare(`
      UPDATE active_guardians
      SET ${fields.join(', ')}
      WHERE guardian_id = @guardian_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getActiveGuardian(guardianId);
  }

  listActiveGuardians(projectId: string, status?: GuardianStatus): ActiveGuardian[] {
    let sql = `
      SELECT guardian_id, project_id, guardian_type, agent_name, status,
             shadow_targets, speak_on, spawned_at, stopped_at, error
      FROM active_guardians
      WHERE project_id = ?
    `;
    const params: unknown[] = [projectId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY spawned_at DESC';

    const stmt = this.db.prepare<unknown[], ActiveGuardianRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToActiveGuardian(row));
  }

  getAllActiveGuardians(): ActiveGuardian[] {
    const stmt = this.db.prepare<[], ActiveGuardianRow>(`
      SELECT guardian_id, project_id, guardian_type, agent_name, status,
             shadow_targets, speak_on, spawned_at, stopped_at, error
      FROM active_guardians
      WHERE status = 'active'
      ORDER BY spawned_at DESC
    `);
    const rows = stmt.all();
    return rows.map((row) => this.rowToActiveGuardian(row));
  }

  stopGuardian(guardianId: string, error?: string): ActiveGuardian | null {
    const now = new Date().toISOString();
    const status = error ? 'error' : 'stopped';
    return this.updateActiveGuardian(guardianId, {
      status: status as GuardianStatus,
      stopped_at: now,
      error,
    });
  }

  // ============================================
  // Transaction support
  // ============================================

  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  // ============================================
  // Lifecycle
  // ============================================

  close(): void {
    this.db.close();
  }

  // ============================================
  // Row-to-entity mapping functions
  // ============================================

  private rowToRun(row: RunRow): Run {
    return {
      run_id: row.run_id,
      plan_id: row.plan_id,
      plan_version: row.plan_version,
      status: row.status as RunStatus,
      has_pending_gate: row.has_pending_gate === 1,
      started_at: row.started_at ?? undefined,
      completed_at: row.completed_at ?? undefined,
      error: row.error ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToTask(row: TaskRow): Task {
    return {
      task_id: row.task_id,
      run_id: row.run_id,
      step_id: row.step_id,
      step_title: row.step_title,
      status: row.status as TaskStatus,
      dependencies: safeJsonParse<string[]>(row.dependencies, [], `task ${row.task_id} dependencies`),
      scope: row.scope ?? undefined,
      owner_role: row.owner_role ?? undefined,
      workspace_path: row.workspace_path ?? undefined,
      agent_id: row.agent_id ?? undefined,
      current_attempt: row.current_attempt ?? undefined,
      gate_id: row.gate_id ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToAttempt(row: TaskAttemptRow): TaskAttempt {
    return {
      attempt_id: row.attempt_id,
      task_id: row.task_id,
      attempt_number: row.attempt_number,
      started_at: row.started_at,
      ended_at: row.ended_at ?? undefined,
      outcome: (row.outcome as AttemptOutcome) ?? undefined,
      error: row.error ?? undefined,
      agent_id: row.agent_id ?? undefined,
      audit_findings: row.audit_findings
        ? safeJsonParse<AuditFinding[]>(row.audit_findings, [], `attempt ${row.attempt_id} audit_findings`)
        : undefined,
    };
  }

  private rowToArtifact(row: ArtifactRow): Artifact {
    return {
      artifact_id: row.artifact_id,
      task_id: row.task_id,
      type: row.type as ArtifactType,
      reference: row.reference,
      metadata: row.metadata
        ? safeJsonParse<Record<string, unknown>>(row.metadata, {}, `artifact ${row.artifact_id} metadata`)
        : undefined,
      created_at: row.created_at,
    };
  }

  private rowToGate(row: GateRow): Gate {
    return {
      gate_id: row.gate_id,
      task_id: row.task_id,
      status: row.status as GateStatus,
      approver_role: row.approver_role ?? undefined,
      decided_by: row.decided_by ?? undefined,
      decided_at: row.decided_at ?? undefined,
      comment: row.comment ?? undefined,
      created_at: row.created_at,
    };
  }

  private rowToCheckpoint(row: CheckpointRow): Checkpoint {
    return {
      checkpoint_id: row.checkpoint_id,
      run_id: row.run_id,
      run_status: row.run_status as RunStatus,
      has_pending_gate: row.has_pending_gate === 1,
      tasks_snapshot: safeJsonParse<TaskSnapshot[]>(row.tasks_snapshot, [], `checkpoint ${row.checkpoint_id} tasks_snapshot`),
      active_agents: safeJsonParse<string[]>(row.active_agents, [], `checkpoint ${row.checkpoint_id} active_agents`),
      snapshot: safeJsonParse<Record<string, unknown>>(row.snapshot, {}, `checkpoint ${row.checkpoint_id} snapshot`),
      created_at: row.created_at,
    };
  }

  private rowToTrajectoryEvent(row: TrajectoryEventRow): TrajectoryEvent {
    return {
      event_id: row.event_id,
      run_id: row.run_id,
      task_id: row.task_id ?? undefined,
      event_type: row.event_type,
      payload: safeJsonParse<Record<string, unknown>>(row.payload, {}, `trajectory event ${row.event_id} payload`),
      timestamp: row.timestamp,
    };
  }

  private rowToQuestion(row: QuestionRow): Question {
    return {
      question_id: row.question_id,
      run_id: row.run_id,
      task_id: row.task_id ?? undefined,
      agent_id: row.agent_id,
      text: row.text,
      options: row.options ? safeJsonParse<string[]>(row.options, [], `question ${row.question_id} options`) : undefined,
      blocking_level: row.blocking_level as QuestionBlockingLevel,
      steps_blocked: row.steps_blocked,
      cascade_depth: row.cascade_depth,
      can_use_default: row.can_use_default === 1,
      default_value: row.default_value ?? undefined,
      subscribers: safeJsonParse<string[]>(row.subscribers, [], `question ${row.question_id} subscribers`),
      status: row.status as QuestionStatus,
      answer: row.answer ?? undefined,
      answered_by: row.answered_by ?? undefined,
      priority_score: row.priority_score,
      created_at: row.created_at,
      answered_at: row.answered_at ?? undefined,
    };
  }

  private rowToUserTrajectoryEvent(row: UserTrajectoryEventRow): UserTrajectoryEvent {
    return {
      event_id: row.event_id,
      user_id: row.user_id,
      scope: row.scope as UserTrajectoryScope,
      question_text: row.question_text,
      selected_option: row.selected_option,
      reasoning: row.reasoning ?? undefined,
      run_id: row.run_id ?? undefined,
      task_id: row.task_id ?? undefined,
      project_id: row.project_id ?? undefined,
      category: row.category ?? undefined,
      timestamp: row.timestamp,
    };
  }

  private rowToDerivedPreference(row: DerivedPreferenceRow): DerivedPreference {
    return {
      preference_id: row.preference_id,
      user_id: row.user_id,
      scope: row.scope as UserTrajectoryScope,
      project_id: row.project_id ?? undefined,
      run_id: row.run_id ?? undefined,
      category: row.category,
      value: row.value,
      confidence: row.confidence,
      evidence_count: row.evidence_count,
      last_expressed: row.last_expressed,
      is_override: row.is_override === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToGuardianEvent(row: GuardianEventRow): GuardianEvent {
    return {
      event_id: row.event_id,
      project_id: row.project_id,
      guardian_type: row.guardian_type as 'Security' | 'Architect' | 'QA' | 'Compliance',
      observation: row.observation,
      concern_level: row.concern_level as GuardianConcernLevel,
      recommendation: row.recommendation ?? undefined,
      timestamp: row.timestamp,
      run_id: row.run_id ?? undefined,
      task_id: row.task_id ?? undefined,
      worker_agent_id: row.worker_agent_id ?? undefined,
      trigger_type: row.trigger_type ?? undefined,
      intervention_taken: row.intervention_taken ?? undefined,
    };
  }

  private rowToActiveGuardian(row: ActiveGuardianRow): ActiveGuardian {
    return {
      guardian_id: row.guardian_id,
      project_id: row.project_id,
      guardian_type: row.guardian_type as 'Security' | 'Architect' | 'QA' | 'Compliance',
      agent_name: row.agent_name,
      status: row.status as GuardianStatus,
      shadow_targets: safeJsonParse<string[]>(row.shadow_targets, [], `guardian ${row.guardian_id} shadow_targets`),
      speak_on: safeJsonParse<string[]>(row.speak_on, [], `guardian ${row.guardian_id} speak_on`),
      spawned_at: row.spawned_at,
      stopped_at: row.stopped_at ?? undefined,
      error: row.error ?? undefined,
    };
  }

  // ============================================
  // Task Execution Metrics (DOT Framework)
  // ============================================

  saveTaskMetric(metric: TaskExecutionMetric): TaskExecutionMetric {
    const stmt = this.db.prepare(`
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

  getTaskMetrics(runId: string): TaskExecutionMetric[] {
    const stmt = this.db.prepare<string, TaskExecutionMetricRow>(`
      SELECT metric_id, task_id, run_id, model_id, complexity_score,
             duration_ms, tokens_used, cost_usd, outcome, confidence, created_at
      FROM task_execution_metrics
      WHERE run_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToTaskExecutionMetric(row));
  }

  getTaskMetricsByModel(modelId: string): TaskExecutionMetric[] {
    const stmt = this.db.prepare<string, TaskExecutionMetricRow>(`
      SELECT metric_id, task_id, run_id, model_id, complexity_score,
             duration_ms, tokens_used, cost_usd, outcome, confidence, created_at
      FROM task_execution_metrics
      WHERE model_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(modelId);
    return rows.map((row) => this.rowToTaskExecutionMetric(row));
  }

  private rowToTaskExecutionMetric(row: TaskExecutionMetricRow): TaskExecutionMetric {
    return {
      metric_id: row.metric_id,
      task_id: row.task_id,
      run_id: row.run_id,
      model_id: row.model_id ?? undefined,
      complexity_score: row.complexity_score ?? undefined,
      duration_ms: row.duration_ms ?? undefined,
      tokens_used: row.tokens_used ?? undefined,
      cost_usd: row.cost_usd ?? undefined,
      outcome: row.outcome as AttemptOutcome | undefined,
      confidence: row.confidence ?? undefined,
      created_at: row.created_at,
    };
  }

  // ============================================
  // Run Budgets (DOT Framework)
  // ============================================

  initRunBudget(
    runId: string,
    tokensAllowed?: number,
    costAllowedUsd?: number
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
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

  updateRunBudget(
    runId: string,
    tokensUsed: number,
    costUsed: number
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
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

  getRunBudget(runId: string): {
    tokens_used: number;
    tokens_allowed: number | null;
    cost_used_usd: number;
    cost_allowed_usd: number | null;
  } | null {
    const stmt = this.db.prepare<string, RunBudgetRow>(`
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
}

// ============================================
// Factory function
// ============================================

/**
 * Creates a new ForgeStorage instance backed by SQLite.
 * @param dbPath Path to the SQLite database file, or ':memory:' for in-memory
 */
export function createForgeStorage(dbPath: string = ':memory:'): ForgeStorage {
  return new SqliteForgeStorage(dbPath);
}
