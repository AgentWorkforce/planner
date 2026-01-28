/**
 * SQLite database schema definitions for planner-core.
 *
 * Tables:
 * - plans: stores Plan entities
 * - versions: stores PlanVersion entities (with summary as JSON)
 * - steps: stores Step entities for each version (with full step data as JSON)
 */

/**
 * SQL to create the plans table.
 * Primary key is plan_id (UUID).
 */
export const CREATE_PLANS_TABLE = `
CREATE TABLE IF NOT EXISTS plans (
  plan_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
`;

/**
 * SQL to create the versions table.
 * Composite primary key: (plan_id, version).
 * Foreign key to plans table.
 */
export const CREATE_VERSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS versions (
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'published')),
  summary_json TEXT NOT NULL,
  submitted_at TEXT,
  approval_info_json TEXT,
  change_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (plan_id, version),
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
)
`;

/**
 * SQL to create the steps table.
 * Composite primary key: (plan_id, version, step_id).
 * Foreign key to versions table.
 * step_order maintains insertion order for consistent retrieval.
 */
export const CREATE_STEPS_TABLE = `
CREATE TABLE IF NOT EXISTS steps (
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  step_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_json TEXT NOT NULL,
  PRIMARY KEY (plan_id, version, step_id),
  FOREIGN KEY (plan_id, version) REFERENCES versions(plan_id, version) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by plan_id on versions table.
 */
export const CREATE_VERSIONS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_versions_plan_id ON versions(plan_id)
`;

/**
 * Index for faster lookups by status on versions table.
 */
export const CREATE_VERSIONS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_versions_status ON versions(status)
`;

/**
 * Index for faster lookups by plan_id and version on steps table.
 */
export const CREATE_STEPS_VERSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_steps_version ON steps(plan_id, version)
`;

/**
 * SQL to create the change_requests table.
 * Tracks change requests from Orchestrator.
 */
export const CREATE_CHANGE_REQUESTS_TABLE = `
CREATE TABLE IF NOT EXISTS change_requests (
  change_request_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_changes_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'rejected')),
  result_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by plan_id on change_requests table.
 */
export const CREATE_CHANGE_REQUESTS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_change_requests_plan_id ON change_requests(plan_id)
`;

/**
 * Index for faster lookups by run_id on change_requests table.
 */
export const CREATE_CHANGE_REQUESTS_RUN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_change_requests_run_id ON change_requests(run_id)
`;

/**
 * All schema creation statements in order.
 */
export const ALL_SCHEMA_STATEMENTS = [
  CREATE_PLANS_TABLE,
  CREATE_VERSIONS_TABLE,
  CREATE_STEPS_TABLE,
  CREATE_VERSIONS_PLAN_INDEX,
  CREATE_VERSIONS_STATUS_INDEX,
  CREATE_STEPS_VERSION_INDEX,
  CREATE_CHANGE_REQUESTS_TABLE,
  CREATE_CHANGE_REQUESTS_PLAN_INDEX,
  CREATE_CHANGE_REQUESTS_RUN_INDEX,
];
