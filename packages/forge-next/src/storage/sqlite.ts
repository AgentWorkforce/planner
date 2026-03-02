/**
 * SQLite implementation of ForgeNextStorage using better-sqlite3.
 *
 * All operations are synchronous (better-sqlite3 design). JSON fields
 * (config, workflow_config, payload) are serialised/deserialised at the
 * storage boundary so callers always see typed values.
 */

import { BaseSqliteStorage } from '@plannr/storage-base';
import { initSchema } from './schema.js';
import type { ForgeNextStorage } from './interface.js';
import type { ForgeNextEvent, ForgeNextRun, Gate, Question } from '../types.js';

// ---------------------------------------------------------------------------
// Row shapes returned by better-sqlite3 (all values are primitive SQLite types)
// ---------------------------------------------------------------------------

interface RunRow {
  id: string;
  plan_id: string;
  plan_version: number;
  relay_run_id: string | null;
  status: string;
  config: string;
  workflow_config: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface GateRow {
  id: string;
  run_id: string;
  step_id: string;
  step_name: string;
  status: string;
  approver: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
}

interface QuestionRow {
  id: string;
  run_id: string;
  step_id: string;
  agent_id: string | null;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
  answered_at: string | null;
}

interface EventRow {
  id: number;
  run_id: string;
  event_type: string;
  payload: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Row mappers (SQLite row → domain type)
// ---------------------------------------------------------------------------

function rowToRun(row: RunRow): ForgeNextRun {
  return {
    id: row.id,
    plan_id: row.plan_id,
    plan_version: row.plan_version,
    relay_run_id: row.relay_run_id,
    status: row.status as ForgeNextRun['status'],
    config: row.config,
    workflow_config: row.workflow_config,
    error: row.error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToGate(row: GateRow): Gate {
  return {
    id: row.id,
    run_id: row.run_id,
    step_id: row.step_id,
    step_name: row.step_name,
    status: row.status as Gate['status'],
    approver: row.approver,
    decision_note: row.decision_note,
    created_at: row.created_at,
    decided_at: row.decided_at,
  };
}

function rowToQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    run_id: row.run_id,
    step_id: row.step_id,
    agent_id: row.agent_id,
    question: row.question,
    answer: row.answer,
    status: row.status as Question['status'],
    created_at: row.created_at,
    answered_at: row.answered_at,
  };
}

function rowToEvent(row: EventRow): ForgeNextEvent {
  return {
    id: row.id,
    run_id: row.run_id,
    event_type: row.event_type,
    payload: row.payload,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SqliteForgeNextStorage extends BaseSqliteStorage implements ForgeNextStorage {
  constructor(dbPath: string = ':memory:') {
    super(dbPath);
  }

  protected initializeSchema(): void {
    initSchema(this.db);
  }

  // ---------------------------------------------------------------------------
  // Runs
  // ---------------------------------------------------------------------------

  createRun(run: ForgeNextRun): ForgeNextRun {
    this.db
      .prepare<RunRow>(
        `INSERT INTO forge_runs
         (id, plan_id, plan_version, relay_run_id, status, config, workflow_config, error, created_at, updated_at)
         VALUES
         (@id, @plan_id, @plan_version, @relay_run_id, @status, @config, @workflow_config, @error, @created_at, @updated_at)`,
      )
      .run(run as unknown as RunRow);
    return run;
  }

  getRun(id: string): ForgeNextRun | null {
    const row = this.db
      .prepare<[string], RunRow>(`SELECT * FROM forge_runs WHERE id = ?`)
      .get(id);
    return row ? rowToRun(row) : null;
  }

  updateRun(id: string, patch: Partial<ForgeNextRun>): void {
    const fields = Object.keys(patch) as Array<keyof ForgeNextRun>;
    if (fields.length === 0) return;

    const setClauses = fields.map((f) => `${f} = @${f}`).join(', ');
    this.db
      .prepare(`UPDATE forge_runs SET ${setClauses} WHERE id = @id`)
      .run({ ...patch, id });
  }

  listRuns(limit = 50): ForgeNextRun[] {
    const rows = this.db
      .prepare<[number], RunRow>(
        `SELECT * FROM forge_runs ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit);
    return rows.map(rowToRun);
  }

  // ---------------------------------------------------------------------------
  // Gates
  // ---------------------------------------------------------------------------

  createGate(gate: Gate): Gate {
    this.db
      .prepare<GateRow>(
        `INSERT INTO forge_gates
         (id, run_id, step_id, step_name, status, approver, decision_note, created_at, decided_at)
         VALUES
         (@id, @run_id, @step_id, @step_name, @status, @approver, @decision_note, @created_at, @decided_at)`,
      )
      .run(gate as unknown as GateRow);
    return gate;
  }

  getGate(id: string): Gate | null {
    const row = this.db
      .prepare<[string], GateRow>(`SELECT * FROM forge_gates WHERE id = ?`)
      .get(id);
    return row ? rowToGate(row) : null;
  }

  updateGate(id: string, patch: Partial<Gate>): void {
    const fields = Object.keys(patch) as Array<keyof Gate>;
    if (fields.length === 0) return;

    const setClauses = fields.map((f) => `${f} = @${f}`).join(', ');
    this.db
      .prepare(`UPDATE forge_gates SET ${setClauses} WHERE id = @id`)
      .run({ ...patch, id });
  }

  listGatesByRun(runId: string): Gate[] {
    const rows = this.db
      .prepare<[string], GateRow>(
        `SELECT * FROM forge_gates WHERE run_id = ? ORDER BY created_at ASC`,
      )
      .all(runId);
    return rows.map(rowToGate);
  }

  listPendingGates(runId: string): Gate[] {
    const rows = this.db
      .prepare<[string, string], GateRow>(
        `SELECT * FROM forge_gates WHERE run_id = ? AND status = ? ORDER BY created_at ASC`,
      )
      .all(runId, 'pending');
    return rows.map(rowToGate);
  }

  // ---------------------------------------------------------------------------
  // Questions
  // ---------------------------------------------------------------------------

  createQuestion(question: Question): Question {
    this.db
      .prepare<QuestionRow>(
        `INSERT INTO forge_questions
         (id, run_id, step_id, agent_id, question, answer, status, created_at, answered_at)
         VALUES
         (@id, @run_id, @step_id, @agent_id, @question, @answer, @status, @created_at, @answered_at)`,
      )
      .run(question as unknown as QuestionRow);
    return question;
  }

  getQuestion(id: string): Question | null {
    const row = this.db
      .prepare<[string], QuestionRow>(`SELECT * FROM forge_questions WHERE id = ?`)
      .get(id);
    return row ? rowToQuestion(row) : null;
  }

  updateQuestion(id: string, patch: Partial<Question>): void {
    const fields = Object.keys(patch) as Array<keyof Question>;
    if (fields.length === 0) return;

    const setClauses = fields.map((f) => `${f} = @${f}`).join(', ');
    this.db
      .prepare(`UPDATE forge_questions SET ${setClauses} WHERE id = @id`)
      .run({ ...patch, id });
  }

  listQuestionsByRun(runId: string): Question[] {
    const rows = this.db
      .prepare<[string], QuestionRow>(
        `SELECT * FROM forge_questions WHERE run_id = ? ORDER BY created_at ASC`,
      )
      .all(runId);
    return rows.map(rowToQuestion);
  }

  listPendingQuestions(runId: string): Question[] {
    const rows = this.db
      .prepare<[string, string], QuestionRow>(
        `SELECT * FROM forge_questions WHERE run_id = ? AND status = ? ORDER BY created_at ASC`,
      )
      .all(runId, 'pending');
    return rows.map(rowToQuestion);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  appendEvent(event: Omit<ForgeNextEvent, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO forge_events (run_id, event_type, payload, created_at)
         VALUES (@run_id, @event_type, @payload, @created_at)`,
      )
      .run(event);
  }

  listEventsByRun(runId: string, since?: string): ForgeNextEvent[] {
    let rows: EventRow[];

    if (since !== undefined) {
      rows = this.db
        .prepare<[string, string], EventRow>(
          `SELECT * FROM forge_events
           WHERE run_id = ? AND created_at > ?
           ORDER BY id ASC`,
        )
        .all(runId, since);
    } else {
      rows = this.db
        .prepare<[string], EventRow>(
          `SELECT * FROM forge_events WHERE run_id = ? ORDER BY id ASC`,
        )
        .all(runId);
    }

    return rows.map(rowToEvent);
  }
}
