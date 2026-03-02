/**
 * SQL schema for forge-next.
 *
 * Four domain tables (runs, gates, questions, events) plus two relay adapter
 * tables (workflow_runs, workflow_steps) that mirror the relay SDK's
 * WorkflowRunRow and WorkflowStepRow shapes.
 *
 * All CREATE statements use IF NOT EXISTS so initSchema is safe to re-run.
 */

import type Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

const CREATE_FORGE_RUNS = `
CREATE TABLE IF NOT EXISTS forge_runs (
  id             TEXT NOT NULL PRIMARY KEY,
  plan_id        TEXT NOT NULL,
  plan_version   INTEGER NOT NULL,
  relay_run_id   TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  config         TEXT NOT NULL,
  workflow_config TEXT,
  error          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
)`;

const CREATE_FORGE_RUNS_IDX_STATUS = `
CREATE INDEX IF NOT EXISTS idx_forge_runs_status
  ON forge_runs (status)`;

const CREATE_FORGE_RUNS_IDX_PLAN = `
CREATE INDEX IF NOT EXISTS idx_forge_runs_plan_id
  ON forge_runs (plan_id)`;

const CREATE_FORGE_GATES = `
CREATE TABLE IF NOT EXISTS forge_gates (
  id            TEXT NOT NULL PRIMARY KEY,
  run_id        TEXT NOT NULL,
  step_id       TEXT NOT NULL,
  step_name     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  approver      TEXT,
  decision_note TEXT,
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  FOREIGN KEY (run_id) REFERENCES forge_runs (id)
)`;

const CREATE_FORGE_GATES_IDX_RUN = `
CREATE INDEX IF NOT EXISTS idx_forge_gates_run_id
  ON forge_gates (run_id)`;

const CREATE_FORGE_GATES_IDX_STATUS = `
CREATE INDEX IF NOT EXISTS idx_forge_gates_status
  ON forge_gates (status)`;

const CREATE_FORGE_QUESTIONS = `
CREATE TABLE IF NOT EXISTS forge_questions (
  id          TEXT NOT NULL PRIMARY KEY,
  run_id      TEXT NOT NULL,
  step_id     TEXT NOT NULL,
  agent_id    TEXT,
  question    TEXT NOT NULL,
  answer      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL,
  answered_at TEXT,
  FOREIGN KEY (run_id) REFERENCES forge_runs (id)
)`;

const CREATE_FORGE_QUESTIONS_IDX_RUN = `
CREATE INDEX IF NOT EXISTS idx_forge_questions_run_id
  ON forge_questions (run_id)`;

const CREATE_FORGE_QUESTIONS_IDX_STATUS = `
CREATE INDEX IF NOT EXISTS idx_forge_questions_status
  ON forge_questions (status)`;

const CREATE_FORGE_EVENTS = `
CREATE TABLE IF NOT EXISTS forge_events (
  id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  run_id     TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES forge_runs (id)
)`;

const CREATE_FORGE_EVENTS_IDX_RUN = `
CREATE INDEX IF NOT EXISTS idx_forge_events_run_id
  ON forge_events (run_id)`;

const CREATE_FORGE_EVENTS_IDX_CREATED = `
CREATE INDEX IF NOT EXISTS idx_forge_events_created_at
  ON forge_events (created_at)`;

// ---------------------------------------------------------------------------
// Relay adapter tables (mirrors WorkflowRunRow / WorkflowStepRow shapes)
// ---------------------------------------------------------------------------

const CREATE_WORKFLOW_RUNS = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id             TEXT NOT NULL PRIMARY KEY,
  workspace_id   TEXT NOT NULL,
  workflow_name  TEXT NOT NULL,
  pattern        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  config         TEXT NOT NULL,
  state_snapshot TEXT,
  started_at     TEXT NOT NULL,
  completed_at   TEXT,
  error          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
)`;

const CREATE_WORKFLOW_RUNS_IDX_STATUS = `
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs (status)`;

const CREATE_WORKFLOW_STEPS = `
CREATE TABLE IF NOT EXISTS workflow_steps (
  id           TEXT NOT NULL PRIMARY KEY,
  run_id       TEXT NOT NULL,
  step_name    TEXT NOT NULL,
  agent_name   TEXT,
  step_type    TEXT NOT NULL DEFAULT 'agent',
  status       TEXT NOT NULL DEFAULT 'pending',
  task         TEXT NOT NULL,
  depends_on   TEXT NOT NULL DEFAULT '[]',
  output       TEXT,
  error        TEXT,
  started_at   TEXT,
  completed_at TEXT,
  retry_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES workflow_runs (id)
)`;

const CREATE_WORKFLOW_STEPS_IDX_RUN = `
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_id
  ON workflow_steps (run_id)`;

// ---------------------------------------------------------------------------
// Schema initialiser
// ---------------------------------------------------------------------------

const DDL_STATEMENTS = [
  CREATE_FORGE_RUNS,
  CREATE_FORGE_RUNS_IDX_STATUS,
  CREATE_FORGE_RUNS_IDX_PLAN,
  CREATE_FORGE_GATES,
  CREATE_FORGE_GATES_IDX_RUN,
  CREATE_FORGE_GATES_IDX_STATUS,
  CREATE_FORGE_QUESTIONS,
  CREATE_FORGE_QUESTIONS_IDX_RUN,
  CREATE_FORGE_QUESTIONS_IDX_STATUS,
  CREATE_FORGE_EVENTS,
  CREATE_FORGE_EVENTS_IDX_RUN,
  CREATE_FORGE_EVENTS_IDX_CREATED,
  CREATE_WORKFLOW_RUNS,
  CREATE_WORKFLOW_RUNS_IDX_STATUS,
  CREATE_WORKFLOW_STEPS,
  CREATE_WORKFLOW_STEPS_IDX_RUN,
];

/**
 * Execute all DDL statements against the provided database.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 */
export function initSchema(db: Database.Database): void {
  for (const stmt of DDL_STATEMENTS) {
    db.exec(stmt);
  }
}
