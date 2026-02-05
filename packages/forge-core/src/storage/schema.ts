/**
 * SQLite database schema definitions for forge-core.
 *
 * Tables:
 * - runs: stores Run entities
 * - tasks: stores Task entities for each run
 * - task_attempts: stores TaskAttempt entities for retry tracking
 * - artifacts: stores Artifact references produced by tasks
 * - gates: stores human approval gate state
 * - workspace_cleanup: tracks workspaces scheduled for cleanup
 * - checkpoints: stores durability checkpoints
 * - trajectory_events: stores execution events for observability
 * - questions: stores agent questions awaiting answers
 */

// ============================================
// Runs Table
// ============================================

/**
 * SQL to create the runs table.
 * Primary key is run_id (UUID).
 * document JSONB stores the full Run for LLM context assembly.
 */
export const CREATE_RUNS_TABLE = `
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  has_pending_gate INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  document TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
`;

/**
 * Index for faster lookups by status on runs table.
 */
export const CREATE_RUNS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)
`;

/**
 * Index for faster lookups by plan_id on runs table.
 */
export const CREATE_RUNS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_runs_plan_id ON runs(plan_id)
`;

// ============================================
// Tasks Table
// ============================================

/**
 * SQL to create the tasks table.
 * Primary key is task_id (UUID).
 * Foreign key to runs table.
 */
export const CREATE_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'running', 'auditing', 'awaiting_approval', 'completed', 'failed', 'blocked')),
  dependencies TEXT NOT NULL DEFAULT '[]',
  workspace_path TEXT,
  agent_id TEXT,
  current_attempt INTEGER,
  gate_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by run_id on tasks table.
 */
export const CREATE_TASKS_RUN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tasks_run_id ON tasks(run_id)
`;

/**
 * Index for faster lookups by status on tasks table.
 */
export const CREATE_TASKS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
`;

/**
 * Index for faster lookups by step_id within a run.
 */
export const CREATE_TASKS_STEP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tasks_step_id ON tasks(run_id, step_id)
`;

// ============================================
// Task Attempts Table
// ============================================

/**
 * SQL to create the task_attempts table.
 * Primary key is attempt_id (UUID).
 * Foreign key to tasks table.
 */
export const CREATE_TASK_ATTEMPTS_TABLE = `
CREATE TABLE IF NOT EXISTS task_attempts (
  attempt_id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT CHECK (outcome IN ('success', 'failure', 'timeout', 'cancelled')),
  error TEXT,
  agent_id TEXT,
  audit_findings TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by task_id on task_attempts table.
 */
export const CREATE_ATTEMPTS_TASK_INDEX = `
CREATE INDEX IF NOT EXISTS idx_attempts_task_id ON task_attempts(task_id)
`;

// ============================================
// Artifacts Table
// ============================================

/**
 * SQL to create the artifacts table.
 * Primary key is artifact_id (UUID).
 * Foreign key to tasks table.
 */
export const CREATE_ARTIFACTS_TABLE = `
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('commit', 'pr', 'file', 'deployment', 'test_result')),
  reference TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by task_id on artifacts table.
 */
export const CREATE_ARTIFACTS_TASK_INDEX = `
CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id)
`;

// ============================================
// Gates Table
// ============================================

/**
 * SQL to create the gates table.
 * Primary key is gate_id (UUID).
 * task_id is UNIQUE - one gate per task.
 */
export const CREATE_GATES_TABLE = `
CREATE TABLE IF NOT EXISTS gates (
  gate_id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_role TEXT,
  decided_by TEXT,
  decided_at TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by status on gates table.
 */
export const CREATE_GATES_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_gates_status ON gates(status)
`;

// ============================================
// Workspace Cleanup Table
// ============================================

/**
 * SQL to create the workspace_cleanup table.
 * Tracks workspaces that need to be cleaned up after retention period.
 */
export const CREATE_WORKSPACE_CLEANUP_TABLE = `
CREATE TABLE IF NOT EXISTS workspace_cleanup (
  task_id TEXT PRIMARY KEY NOT NULL,
  cleanup_after TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups of expired cleanup entries.
 */
export const CREATE_CLEANUP_AFTER_INDEX = `
CREATE INDEX IF NOT EXISTS idx_cleanup_after ON workspace_cleanup(cleanup_after)
`;

// ============================================
// Checkpoints Table
// ============================================

/**
 * SQL to create the checkpoints table.
 * Stores durability checkpoints for run recovery.
 * Enhanced with run_status, has_pending_gate, tasks_snapshot, and active_agents
 * for faster recovery without needing to parse the full snapshot.
 */
export const CREATE_CHECKPOINTS_TABLE = `
CREATE TABLE IF NOT EXISTS checkpoints (
  checkpoint_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  run_status TEXT NOT NULL CHECK (run_status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  has_pending_gate INTEGER NOT NULL DEFAULT 0,
  tasks_snapshot TEXT NOT NULL DEFAULT '[]',
  active_agents TEXT NOT NULL DEFAULT '[]',
  snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
)
`;

/**
 * Migration to add new columns to existing checkpoints table.
 * Safe to run even if columns already exist (uses IF NOT EXISTS pattern).
 */
export const MIGRATE_CHECKPOINTS_TABLE = `
-- Add run_status if not exists
ALTER TABLE checkpoints ADD COLUMN run_status TEXT NOT NULL DEFAULT 'running' CHECK (run_status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'));
-- Add has_pending_gate if not exists
ALTER TABLE checkpoints ADD COLUMN has_pending_gate INTEGER NOT NULL DEFAULT 0;
-- Add tasks_snapshot if not exists
ALTER TABLE checkpoints ADD COLUMN tasks_snapshot TEXT NOT NULL DEFAULT '[]';
-- Add active_agents if not exists
ALTER TABLE checkpoints ADD COLUMN active_agents TEXT NOT NULL DEFAULT '[]';
`;

/**
 * Index for faster lookups by run_id on checkpoints table.
 */
export const CREATE_CHECKPOINTS_RUN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_checkpoints_run_id ON checkpoints(run_id)
`;

// ============================================
// Trajectory Events Table
// ============================================

/**
 * SQL to create the trajectory_events table.
 * Stores execution events for observability and debugging.
 */
export const CREATE_TRAJECTORY_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS trajectory_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
)
`;

/**
 * Index for faster lookups by run_id and timestamp.
 */
export const CREATE_TRAJECTORY_RUN_TIMESTAMP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_trajectory_run_timestamp ON trajectory_events(run_id, timestamp DESC)
`;

/**
 * Index for faster lookups by event_type.
 */
export const CREATE_TRAJECTORY_EVENT_TYPE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_trajectory_event_type ON trajectory_events(run_id, event_type)
`;

// ============================================
// Questions Table
// ============================================

/**
 * SQL to create the questions table.
 * Stores agent questions awaiting human answers with priority-based queue.
 *
 * Enhanced fields for question queue feature:
 * - steps_blocked: number of tasks waiting on this answer
 * - cascade_depth: dependency depth affected
 * - can_use_default: whether timeout should use default_value
 * - default_value: value to use on timeout
 * - subscribers: JSON array of agent IDs subscribed to answer
 * - answered_by: who provided the answer
 */
export const CREATE_QUESTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT,
  agent_id TEXT NOT NULL,
  text TEXT NOT NULL,
  options TEXT,
  blocking_level TEXT NOT NULL CHECK (blocking_level IN ('hard_block', 'soft_block', 'preference', 'fyi')),
  steps_blocked INTEGER NOT NULL DEFAULT 0,
  cascade_depth INTEGER NOT NULL DEFAULT 0,
  can_use_default INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  subscribers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'dismissed', 'auto_defaulted', 'auto_answered_from_trajectory')),
  answer TEXT,
  answered_by TEXT,
  priority_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  answered_at TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
)
`;

/**
 * Index for priority-based sorting of pending questions.
 */
export const CREATE_QUESTIONS_PRIORITY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_questions_priority ON questions(run_id, status, priority_score DESC)
`;

/**
 * Index for faster lookups by run_id.
 */
export const CREATE_QUESTIONS_RUN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_questions_run_id ON questions(run_id)
`;

// ============================================
// Guardian Trajectories Table
// ============================================

/**
 * SQL to create the guardian_trajectories table.
 * Stores events observed and recorded by guardian agents.
 */
export const CREATE_GUARDIAN_TRAJECTORIES_TABLE = `
CREATE TABLE IF NOT EXISTS guardian_trajectories (
  event_id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  guardian_type TEXT NOT NULL CHECK (guardian_type IN ('Security', 'Architect', 'QA', 'Compliance')),
  observation TEXT NOT NULL,
  concern_level TEXT NOT NULL CHECK (concern_level IN ('info', 'warning', 'critical')),
  recommendation TEXT,
  timestamp TEXT NOT NULL,
  run_id TEXT,
  task_id TEXT,
  worker_agent_id TEXT,
  trigger_type TEXT,
  intervention_taken TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
)
`;

/**
 * Index for faster lookups by project_id and guardian_type.
 */
export const CREATE_GUARDIAN_TRAJECTORIES_PROJECT_TYPE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_guardian_trajectories_project_type ON guardian_trajectories(project_id, guardian_type)
`;

/**
 * Index for faster lookups by timestamp.
 */
export const CREATE_GUARDIAN_TRAJECTORIES_TIMESTAMP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_guardian_trajectories_timestamp ON guardian_trajectories(timestamp DESC)
`;

/**
 * Index for faster lookups by concern_level.
 */
export const CREATE_GUARDIAN_TRAJECTORIES_CONCERN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_guardian_trajectories_concern ON guardian_trajectories(project_id, concern_level)
`;

// ============================================
// Active Guardians Table
// ============================================

/**
 * SQL to create the active_guardians table.
 * Tracks currently active guardian agents for a project.
 */
export const CREATE_ACTIVE_GUARDIANS_TABLE = `
CREATE TABLE IF NOT EXISTS active_guardians (
  guardian_id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  guardian_type TEXT NOT NULL CHECK (guardian_type IN ('Security', 'Architect', 'QA', 'Compliance')),
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'stopped', 'error')),
  shadow_targets TEXT NOT NULL DEFAULT '[]',
  speak_on TEXT NOT NULL DEFAULT '[]',
  spawned_at TEXT NOT NULL,
  stopped_at TEXT,
  error TEXT
)
`;

/**
 * Index for faster lookups by project_id.
 */
export const CREATE_ACTIVE_GUARDIANS_PROJECT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_active_guardians_project ON active_guardians(project_id)
`;

/**
 * Index for faster lookups by status.
 */
export const CREATE_ACTIVE_GUARDIANS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_active_guardians_status ON active_guardians(status)
`;

// ============================================
// User Trajectory Events Table
// ============================================

/**
 * SQL to create the user_trajectory_events table.
 * Stores user decisions when answering questions for preference derivation.
 */
export const CREATE_USER_TRAJECTORY_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS user_trajectory_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project', 'run')),
  question_text TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  reasoning TEXT,
  run_id TEXT,
  task_id TEXT,
  project_id TEXT,
  category TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL
)
`;

/**
 * Index for faster lookups by user_id and scope.
 */
export const CREATE_USER_TRAJECTORY_USER_SCOPE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_user_trajectory_user_scope ON user_trajectory_events(user_id, scope)
`;

/**
 * Index for faster lookups by user_id and category for preference derivation.
 */
export const CREATE_USER_TRAJECTORY_USER_CATEGORY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_user_trajectory_user_category ON user_trajectory_events(user_id, category)
`;

/**
 * Index for faster lookups by question_text for similarity matching.
 */
export const CREATE_USER_TRAJECTORY_QUESTION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_user_trajectory_question ON user_trajectory_events(user_id, question_text)
`;

// ============================================
// User Preferences Table
// ============================================

/**
 * SQL to create the user_preferences table.
 * Stores derived preferences from user trajectory events.
 */
export const CREATE_USER_PREFERENCES_TABLE = `
CREATE TABLE IF NOT EXISTS user_preferences (
  preference_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project', 'run')),
  project_id TEXT,
  run_id TEXT,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  last_expressed TEXT NOT NULL,
  is_override INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE SET NULL,
  UNIQUE (user_id, scope, category, project_id, run_id)
)
`;

/**
 * Index for faster preference lookups by user_id, scope, and category.
 */
export const CREATE_USER_PREFERENCES_LOOKUP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_user_preferences_lookup ON user_preferences(user_id, scope, category)
`;

/**
 * Index for confidence-based filtering.
 */
export const CREATE_USER_PREFERENCES_CONFIDENCE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_user_preferences_confidence ON user_preferences(user_id, confidence DESC)
`;

// ============================================
// All Schema Statements
// ============================================

/**
 * All schema creation statements in order.
 */
export const ALL_SCHEMA_STATEMENTS = [
  // Core tables
  CREATE_RUNS_TABLE,
  CREATE_RUNS_STATUS_INDEX,
  CREATE_RUNS_PLAN_INDEX,
  CREATE_TASKS_TABLE,
  CREATE_TASKS_RUN_INDEX,
  CREATE_TASKS_STATUS_INDEX,
  CREATE_TASKS_STEP_INDEX,
  CREATE_TASK_ATTEMPTS_TABLE,
  CREATE_ATTEMPTS_TASK_INDEX,
  CREATE_ARTIFACTS_TABLE,
  CREATE_ARTIFACTS_TASK_INDEX,
  CREATE_GATES_TABLE,
  CREATE_GATES_STATUS_INDEX,
  CREATE_WORKSPACE_CLEANUP_TABLE,
  CREATE_CLEANUP_AFTER_INDEX,
  // Durability
  CREATE_CHECKPOINTS_TABLE,
  CREATE_CHECKPOINTS_RUN_INDEX,
  // Observability
  CREATE_TRAJECTORY_EVENTS_TABLE,
  CREATE_TRAJECTORY_RUN_TIMESTAMP_INDEX,
  CREATE_TRAJECTORY_EVENT_TYPE_INDEX,
  // Question queue
  CREATE_QUESTIONS_TABLE,
  CREATE_QUESTIONS_PRIORITY_INDEX,
  CREATE_QUESTIONS_RUN_INDEX,
  // Guardian trajectories
  CREATE_GUARDIAN_TRAJECTORIES_TABLE,
  CREATE_GUARDIAN_TRAJECTORIES_PROJECT_TYPE_INDEX,
  CREATE_GUARDIAN_TRAJECTORIES_TIMESTAMP_INDEX,
  CREATE_GUARDIAN_TRAJECTORIES_CONCERN_INDEX,
  // Active guardians
  CREATE_ACTIVE_GUARDIANS_TABLE,
  CREATE_ACTIVE_GUARDIANS_PROJECT_INDEX,
  CREATE_ACTIVE_GUARDIANS_STATUS_INDEX,
  // User trajectory
  CREATE_USER_TRAJECTORY_EVENTS_TABLE,
  CREATE_USER_TRAJECTORY_USER_SCOPE_INDEX,
  CREATE_USER_TRAJECTORY_USER_CATEGORY_INDEX,
  CREATE_USER_TRAJECTORY_QUESTION_INDEX,
  CREATE_USER_PREFERENCES_TABLE,
  CREATE_USER_PREFERENCES_LOOKUP_INDEX,
  CREATE_USER_PREFERENCES_CONFIDENCE_INDEX,
];
