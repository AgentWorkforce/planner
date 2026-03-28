/**
 * SQLite schema for Tuner storage.
 */

export const SCHEMA_STATEMENTS = [
  // Task outcomes (raw data from Forge)
  `CREATE TABLE IF NOT EXISTS task_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    model_used TEXT NOT NULL,
    complexity_estimate TEXT,
    language_tier TEXT,
    outcome TEXT NOT NULL,
    error_category TEXT,
    attempts INTEGER NOT NULL,
    duration_seconds REAL NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    confidence_score REAL,
    tests_passed INTEGER,
    tests_total INTEGER,
    tests_failed_count INTEGER,
    build_passed INTEGER,
    type_check_passed INTEGER,
    lint_passed INTEGER,
    ac_results TEXT,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'production'
  )`,

  // Indexes for task_outcomes
  `CREATE INDEX IF NOT EXISTS idx_task_outcomes_run ON task_outcomes(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_task_outcomes_timestamp ON task_outcomes(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_task_outcomes_source ON task_outcomes(source)`,

  // Run outcomes (aggregate data)
  `CREATE TABLE IF NOT EXISTS run_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    tasks_total INTEGER NOT NULL,
    tasks_succeeded INTEGER NOT NULL,
    tasks_failed INTEGER NOT NULL,
    total_duration_seconds REAL NOT NULL,
    total_tokens INTEGER NOT NULL,
    total_cost_usd REAL NOT NULL,
    replan_count INTEGER DEFAULT 0,
    escalation_count INTEGER DEFAULT 0,
    tests_passed_count INTEGER DEFAULT 0,
    tests_failed_count INTEGER DEFAULT 0,
    builds_passed_count INTEGER DEFAULT 0,
    builds_failed_count INTEGER DEFAULT 0,
    ac_met_count INTEGER DEFAULT 0,
    ac_total_count INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'production'
  )`,

  // Task baselines (for drift detection)
  `CREATE TABLE IF NOT EXISTS task_baselines (
    pattern TEXT PRIMARY KEY,
    mean_duration_seconds REAL NOT NULL,
    stddev_duration_seconds REAL NOT NULL,
    mean_tokens REAL NOT NULL,
    stddev_tokens REAL NOT NULL,
    mean_attempts REAL NOT NULL,
    success_rate REAL NOT NULL,
    verification_pass_rate REAL,
    m2_duration REAL DEFAULT 0,
    m2_tokens REAL DEFAULT 0,
    sample_count INTEGER NOT NULL,
    last_updated TEXT NOT NULL
  )`,

  // Model baselines (for Thompson sampling)
  `CREATE TABLE IF NOT EXISTS model_baselines (
    model TEXT NOT NULL,
    task_type TEXT NOT NULL,
    complexity TEXT NOT NULL,
    alpha REAL NOT NULL,
    beta REAL NOT NULL,
    total_attempts INTEGER NOT NULL,
    success_rate REAL NOT NULL,
    mean_cost_per_success REAL NOT NULL,
    last_updated TEXT NOT NULL,
    PRIMARY KEY (model, task_type, complexity)
  )`,

  // Drift alerts (history)
  `CREATE TABLE IF NOT EXISTS drift_alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    current_value REAL NOT NULL,
    baseline_value REAL NOT NULL,
    stddev REAL NOT NULL,
    deviation_sigmas REAL NOT NULL,
    severity TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // Index for drift_alerts
  `CREATE INDEX IF NOT EXISTS idx_drift_alerts_severity ON drift_alerts(severity, acknowledged)`,

  // Config versions (audit trail)
  `CREATE TABLE IF NOT EXISTS config_versions (
    version INTEGER PRIMARY KEY,
    forge_config TEXT NOT NULL,
    planner_config TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    notes TEXT
  )`,

  // Ideation outcomes (raw data from ideation sessions)
  `CREATE TABLE IF NOT EXISTS ideation_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    plan_id TEXT,
    interviewer_model TEXT NOT NULL,
    specialist_count INTEGER NOT NULL,
    confidence_score REAL,
    block_count INTEGER NOT NULL,
    conversation_turns INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('approved', 'rejected', 'abandoned')),
    source TEXT NOT NULL DEFAULT 'production',
    timestamp TEXT NOT NULL
  )`,

  // Indexes for ideation_outcomes
  `CREATE INDEX IF NOT EXISTS idx_ideation_outcomes_session ON ideation_outcomes(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ideation_outcomes_timestamp ON ideation_outcomes(timestamp)`,

  // Plan quality signals (links ideation session to final plan quality)
  `CREATE TABLE IF NOT EXISTS plan_quality_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    version_count INTEGER NOT NULL,
    improvements_made INTEGER NOT NULL,
    block_count INTEGER NOT NULL,
    time_to_approval_ms INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'production',
    timestamp TEXT NOT NULL
  )`,

  // Indexes for plan_quality_signals
  `CREATE INDEX IF NOT EXISTS idx_plan_quality_session ON plan_quality_signals(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_plan_quality_plan ON plan_quality_signals(plan_id)`,

  // Ideation baselines (for session quality metrics)
  `CREATE TABLE IF NOT EXISTS ideation_baselines (
    pattern TEXT PRIMARY KEY,
    mean_questions_per_plan REAL NOT NULL DEFAULT 0,
    mean_versions_per_plan REAL NOT NULL DEFAULT 1,
    mean_block_utilization REAL NOT NULL DEFAULT 0,
    mean_conversation_turns REAL NOT NULL DEFAULT 0,
    mean_time_to_approval_ms REAL NOT NULL DEFAULT 0,
    m2_questions REAL NOT NULL DEFAULT 0,
    m2_versions REAL NOT NULL DEFAULT 0,
    m2_block_utilization REAL NOT NULL DEFAULT 0,
    m2_conversation_turns REAL NOT NULL DEFAULT 0,
    m2_time_to_approval REAL NOT NULL DEFAULT 0,
    alpha REAL NOT NULL DEFAULT 1,
    beta REAL NOT NULL DEFAULT 1,
    approval_rate REAL NOT NULL DEFAULT 0,
    specialist_contribution_rates TEXT NOT NULL DEFAULT '{}',
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL
  )`,
];

/**
 * Migration statements for existing databases.
 * These use ALTER TABLE to add columns that may not exist yet.
 * Each is wrapped in a try/catch at execution time since SQLite
 * doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN.
 */
export const MIGRATION_STATEMENTS = [
  `ALTER TABLE task_outcomes ADD COLUMN source TEXT DEFAULT 'production'`,
  `ALTER TABLE run_outcomes ADD COLUMN source TEXT DEFAULT 'production'`,
];
