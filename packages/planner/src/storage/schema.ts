/**
 * SQLite database schema definitions for planner-core.
 *
 * Tables:
 * - organizations: stores Organization entities
 * - initiatives: stores Initiative entities within organizations
 * - org_members: stores organization membership with roles
 * - plans: stores Plan entities
 * - versions: stores PlanVersion entities (with summary as JSON)
 * - steps: stores Step entities for each version (with full step data as JSON)
 */

/**
 * SQL to create the plans table.
 * Primary key is plan_id (UUID).
 * Plans belong to an organization and optionally an initiative.
 */
export const CREATE_PLANS_TABLE = `
CREATE TABLE IF NOT EXISTS plans (
  plan_id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  initiative_id TEXT,
  owner_user_id TEXT,
  source_json TEXT NOT NULL DEFAULT '{"type":"manual"}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(initiative_id) ON DELETE SET NULL
)
`;

/**
 * Index for faster lookups by org_id on plans table.
 */
export const CREATE_PLANS_ORG_INDEX = `
CREATE INDEX IF NOT EXISTS idx_plans_org_id ON plans(org_id)
`;

/**
 * Index for faster lookups by initiative_id on plans table.
 */
export const CREATE_PLANS_INITIATIVE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_plans_initiative_id ON plans(initiative_id)
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
  understanding_json TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT,
  approval_info_json TEXT,
  change_request_id TEXT,
  metadata_json TEXT,
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
  revision_session_id TEXT,
  revision_status TEXT CHECK (revision_status IN ('none', 'pending', 'in_progress', 'drafted', 'error')),
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
 * SQL to create the comments table.
 * Stores review comments on plan steps with threading support.
 */
export const CREATE_COMMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS comments (
  comment_id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  step_id TEXT NOT NULL,
  parent_id TEXT,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id, version) REFERENCES versions(plan_id, version) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(comment_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by plan_id and version on comments table.
 */
export const CREATE_COMMENTS_VERSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_comments_version ON comments(plan_id, version)
`;

/**
 * Index for faster lookups by step_id on comments table.
 */
export const CREATE_COMMENTS_STEP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_comments_step ON comments(plan_id, version, step_id)
`;

/**
 * Index for faster lookups of unresolved comments.
 */
export const CREATE_COMMENTS_RESOLVED_INDEX = `
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(plan_id, version, resolved)
`;

/**
 * SQL to create the sessions table.
 * Tracks agent sessions for MCP authentication and lifecycle management.
 */
export const CREATE_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  token TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'timeout', 'terminated', 'error')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by token on sessions table.
 */
export const CREATE_SESSIONS_TOKEN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)
`;

/**
 * Index for faster lookups by plan_id on sessions table.
 */
export const CREATE_SESSIONS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_sessions_plan_id ON sessions(plan_id)
`;

/**
 * SQL to create the improvements table.
 * Stores AI-suggested improvements for plans.
 */
export const CREATE_IMPROVEMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS improvements (
  improvement_id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  step_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('missing_criteria', 'unclear_description', 'missing_dependency', 'redundant_step', 'scope_suggestion')),
  description TEXT NOT NULL,
  suggested_change_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id, version) REFERENCES versions(plan_id, version) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by plan_id and version on improvements table.
 */
export const CREATE_IMPROVEMENTS_VERSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_improvements_version ON improvements(plan_id, version)
`;

/**
 * Index for faster lookups by step_id on improvements table.
 */
export const CREATE_IMPROVEMENTS_STEP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_improvements_step ON improvements(plan_id, version, step_id)
`;

/**
 * Index for faster lookups of pending improvements.
 */
export const CREATE_IMPROVEMENTS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_improvements_status ON improvements(plan_id, version, status)
`;

/**
 * SQL to create the questions table.
 * Stores agent questions awaiting human answers with priority-based queue management.
 */
export const CREATE_QUESTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  text TEXT NOT NULL,
  context TEXT,
  options_json TEXT,
  blocking_level TEXT NOT NULL CHECK (blocking_level IN ('hard_block', 'soft_block', 'preference', 'fyi')),
  steps_blocked INTEGER NOT NULL DEFAULT 0,
  can_use_default INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  subscribers_json TEXT NOT NULL DEFAULT '[]',
  merged_from_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'dismissed')),
  answer TEXT,
  answered_at TEXT,
  priority_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by plan_id on questions table.
 */
export const CREATE_QUESTIONS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_questions_plan_id ON questions(plan_id)
`;

/**
 * Index for priority-based sorting of pending questions.
 */
export const CREATE_QUESTIONS_PRIORITY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_questions_priority ON questions(plan_id, status, priority_score DESC)
`;

/**
 * Index for deduplication checks (agent_id + text prefix).
 */
export const CREATE_QUESTIONS_DEDUP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_questions_dedup ON questions(plan_id, agent_id, status)
`;

/**
 * SQL to create the trajectory_events table.
 * Stores decision events from user trajectory during plan sessions.
 */
export const CREATE_TRAJECTORY_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS trajectory_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL DEFAULT 'decision',
  question_id TEXT NOT NULL,
  asking_agent TEXT NOT NULL,
  question_text TEXT NOT NULL,
  context_provided TEXT,
  options_presented_json TEXT NOT NULL,
  selected_option TEXT,
  free_text_response TEXT,
  reasoning TEXT,
  plan_id TEXT NOT NULL,
  step_id TEXT,
  agent_trajectory_ref TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by plan_id on trajectory_events table.
 */
export const CREATE_TRAJECTORY_EVENTS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_trajectory_events_plan_id ON trajectory_events(plan_id)
`;

/**
 * Index for faster lookups by asking_agent on trajectory_events table.
 */
export const CREATE_TRAJECTORY_EVENTS_AGENT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_trajectory_events_agent ON trajectory_events(plan_id, asking_agent)
`;

/**
 * Index for faster lookups by timestamp on trajectory_events table.
 */
export const CREATE_TRAJECTORY_EVENTS_TIMESTAMP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_trajectory_events_timestamp ON trajectory_events(plan_id, timestamp DESC)
`;

/**
 * SQL to create the organizations table.
 * Organizations are containers for initiatives and members.
 */
export const CREATE_ORGANIZATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS organizations (
  org_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
`;

/**
 * SQL to create the initiatives table.
 * Initiatives represent strategic goals within an organization.
 */
export const CREATE_INITIATIVES_TABLE = `
CREATE TABLE IF NOT EXISTS initiatives (
  initiative_id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')),
  icon TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
)
`;

/**
 * Index for faster lookups by org_id on initiatives table.
 */
export const CREATE_INITIATIVES_ORG_INDEX = `
CREATE INDEX IF NOT EXISTS idx_initiatives_org_id ON initiatives(org_id)
`;

/**
 * SQL to create the org_members table.
 * Tracks user membership and roles within organizations.
 */
export const CREATE_ORG_MEMBERS_TABLE = `
CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id),
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
)
`;

/**
 * SQL to create the projects table.
 * Projects link ideation sessions, plans, and forge runs into a unified entity.
 */
export const CREATE_PROJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  owner_id TEXT,
  initiative_id TEXT,
  session_id TEXT,
  plan_id TEXT,
  run_id TEXT,
  config TEXT,
  current_focus TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(initiative_id) ON DELETE SET NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE SET NULL
)
`;

/**
 * Index for faster lookups by initiative_id on projects table.
 */
export const CREATE_PROJECTS_INITIATIVE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_projects_initiative ON projects(initiative_id)
`;

/**
 * Index for faster lookups by session_id on projects table.
 */
export const CREATE_PROJECTS_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_projects_session ON projects(session_id)
`;

/**
 * Index for faster lookups by plan_id on projects table.
 */
export const CREATE_PROJECTS_PLAN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_projects_plan ON projects(plan_id)
`;

/**
 * All schema creation statements in order.
 */
export const ALL_SCHEMA_STATEMENTS = [
  // Organizations must be created before plans (for FK reference)
  CREATE_ORGANIZATIONS_TABLE,
  CREATE_INITIATIVES_TABLE,
  CREATE_INITIATIVES_ORG_INDEX,
  CREATE_ORG_MEMBERS_TABLE,
  // Core plan tables
  CREATE_PLANS_TABLE,
  CREATE_PLANS_ORG_INDEX,
  CREATE_PLANS_INITIATIVE_INDEX,
  CREATE_VERSIONS_TABLE,
  CREATE_STEPS_TABLE,
  CREATE_VERSIONS_PLAN_INDEX,
  CREATE_VERSIONS_STATUS_INDEX,
  CREATE_STEPS_VERSION_INDEX,
  CREATE_CHANGE_REQUESTS_TABLE,
  CREATE_CHANGE_REQUESTS_PLAN_INDEX,
  CREATE_CHANGE_REQUESTS_RUN_INDEX,
  CREATE_COMMENTS_TABLE,
  CREATE_COMMENTS_VERSION_INDEX,
  CREATE_COMMENTS_STEP_INDEX,
  CREATE_COMMENTS_RESOLVED_INDEX,
  CREATE_SESSIONS_TABLE,
  CREATE_SESSIONS_TOKEN_INDEX,
  CREATE_SESSIONS_PLAN_INDEX,
  CREATE_IMPROVEMENTS_TABLE,
  CREATE_IMPROVEMENTS_VERSION_INDEX,
  CREATE_IMPROVEMENTS_STEP_INDEX,
  CREATE_IMPROVEMENTS_STATUS_INDEX,
  // Question queue tables
  CREATE_QUESTIONS_TABLE,
  CREATE_QUESTIONS_PLAN_INDEX,
  CREATE_QUESTIONS_PRIORITY_INDEX,
  CREATE_QUESTIONS_DEDUP_INDEX,
  // Trajectory tables
  CREATE_TRAJECTORY_EVENTS_TABLE,
  CREATE_TRAJECTORY_EVENTS_PLAN_INDEX,
  CREATE_TRAJECTORY_EVENTS_AGENT_INDEX,
  CREATE_TRAJECTORY_EVENTS_TIMESTAMP_INDEX,
  // Projects table
  CREATE_PROJECTS_TABLE,
  CREATE_PROJECTS_INITIATIVE_INDEX,
  CREATE_PROJECTS_SESSION_INDEX,
  CREATE_PROJECTS_PLAN_INDEX,
];
