import { z } from 'zod';

// ============================================
// Run Status
// ============================================

/**
 * Run status lifecycle:
 * - pending: created but not started
 * - running: actively executing tasks
 * - paused: temporarily halted (human gate, error recovery)
 * - completed: all tasks finished successfully
 * - failed: execution failed, cannot recover
 * - cancelled: manually cancelled by user
 */
export const RunStatus = {
  Pending: 'pending',
  Running: 'running',
  Paused: 'paused',
  Completed: 'completed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;

export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

// ============================================
// Task Status
// ============================================

/**
 * Task status lifecycle:
 * - pending: waiting for dependencies
 * - queued: ready to execute, in queue
 * - running: agent is working on task
 * - auditing: auditor is verifying acceptance criteria
 * - awaiting_approval: waiting for human gate approval
 * - completed: task finished successfully
 * - failed: task failed after all retry attempts
 * - blocked: blocked by failed dependency
 */
export const TaskStatus = {
  Pending: 'pending',
  Queued: 'queued',
  Running: 'running',
  Auditing: 'auditing',
  AwaitingApproval: 'awaiting_approval',
  Completed: 'completed',
  Failed: 'failed',
  Blocked: 'blocked',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'auditing',
  'awaiting_approval',
  'completed',
  'failed',
  'blocked',
]);

// ============================================
// Gate Status
// ============================================

/**
 * Gate status for human approval gates:
 * - pending: awaiting decision
 * - approved: gate passed
 * - rejected: gate failed
 */
export const GateStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
} as const;

export type GateStatus = (typeof GateStatus)[keyof typeof GateStatus];

export const GateStatusSchema = z.enum(['pending', 'approved', 'rejected']);

// ============================================
// Artifact Types
// ============================================

/**
 * Types of artifacts that tasks can produce:
 * - commit: Git commit reference
 * - pr: Pull request URL
 * - file: File path reference
 * - deployment: Deployment URL or reference
 * - test_result: Test execution results
 */
export const ArtifactType = {
  Commit: 'commit',
  PR: 'pr',
  File: 'file',
  Deployment: 'deployment',
  TestResult: 'test_result',
} as const;

export type ArtifactType = (typeof ArtifactType)[keyof typeof ArtifactType];

export const ArtifactTypeSchema = z.enum([
  'commit',
  'pr',
  'file',
  'deployment',
  'test_result',
]);

// ============================================
// Task Attempt Outcome
// ============================================

export const AttemptOutcome = {
  Success: 'success',
  Failure: 'failure',
  Timeout: 'timeout',
  Cancelled: 'cancelled',
} as const;

export type AttemptOutcome = (typeof AttemptOutcome)[keyof typeof AttemptOutcome];

export const AttemptOutcomeSchema = z.enum([
  'success',
  'failure',
  'timeout',
  'cancelled',
]);

// ============================================
// Question Blocking Level
// ============================================

export const QuestionBlockingLevel = {
  HardBlock: 'hard_block',
  SoftBlock: 'soft_block',
  Preference: 'preference',
  FYI: 'fyi',
} as const;

export type QuestionBlockingLevel =
  (typeof QuestionBlockingLevel)[keyof typeof QuestionBlockingLevel];

export const QuestionBlockingLevelSchema = z.enum([
  'hard_block',
  'soft_block',
  'preference',
  'fyi',
]);

// ============================================
// Question Status
// ============================================

/**
 * Question status lifecycle:
 * - pending: awaiting human answer
 * - answered: human provided an answer
 * - dismissed: question was dismissed without answer
 * - auto_defaulted: timed out and used default value
 * - auto_answered_from_trajectory: similar answer found in trajectory history
 */
export const QuestionStatus = {
  Pending: 'pending',
  Answered: 'answered',
  Dismissed: 'dismissed',
  AutoDefaulted: 'auto_defaulted',
  AutoAnsweredFromTrajectory: 'auto_answered_from_trajectory',
} as const;

export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const QuestionStatusSchema = z.enum([
  'pending',
  'answered',
  'dismissed',
  'auto_defaulted',
  'auto_answered_from_trajectory',
]);

// ============================================
// Forge Plan & Step (input from Planner)
// ============================================

/**
 * Acceptance criterion for a step
 */
export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  type: z.string().optional(),
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

/**
 * Gate configuration for human approval
 */
export const GateConfigSchema = z.object({
  type: z.literal('human_approval'),
  approver_role: z.string().optional(),
});

export type GateConfig = z.infer<typeof GateConfigSchema>;

/**
 * ForgeStep is the input format from Planner for each step in a plan.
 */
export const ForgeStepSchema = z.object({
  step_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  scope: z.string().optional(),
  owner_role: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).optional(),
  gate: GateConfigSchema.optional(),
  repo_url: z.string().optional(),
  cli: z.string().optional(),
  audit: z.boolean().optional(),
  /** Reference to a sub-plan that this step expands into (creates child Run) */
  sub_plan_id: z.string().uuid().optional(),
  /** Implementation specification from planner (target files, patterns, architecture) */
  specification: z.record(z.string(), z.unknown()).optional(),
  /** Target directory within workspace where agent should create files */
  target_path: z.string().optional(),
});

export type ForgeStep = z.infer<typeof ForgeStepSchema>;

/**
 * ForgePlan is the input format from Planner for creating a Run.
 */
export const ForgePlanSchema = z.object({
  plan_id: z.string().uuid(),
  version: z.number().int().positive(),
  summary: z.object({
    goal: z.string().min(1),
    context: z.string().optional(),
  }),
  steps: z.array(ForgeStepSchema),
  /** Architect context — design decisions, type definitions, patterns (plan-level) */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Understanding — codebase observations, architectural insights (plan-level) */
  understanding: z.record(z.string(), z.unknown()).optional(),
});

export type ForgePlan = z.infer<typeof ForgePlanSchema>;

// ============================================
// Execution Policy (DOT Framework)
// ============================================

/**
 * Budget configuration for execution limits
 * Research basis: METR 2025 - P(success) ~= (0.5)^(T/50min)
 */
export const BudgetsConfigSchema = z.object({
  /** Maximum time per task in seconds (default: 900 = 15 minutes) */
  per_task_time_seconds: z.number().int().positive().default(900),
  /** Maximum tokens per task (default: 100000) */
  per_task_token_limit: z.number().int().positive().default(100000),
  /** Maximum total cost for the entire run in USD (default: 10.0) */
  total_cost_limit_usd: z.number().positive().default(10.0),
});

export type BudgetsConfig = z.infer<typeof BudgetsConfigSchema>;

/**
 * Retry configuration for failure recovery
 * Research basis: Reflexion 2023 - Self-correction with failure analysis +20-30% improvement
 */
export const RetryConfigSchema = z.object({
  /** Maximum retry attempts per task (default: 1 - conservative) */
  max_retries_per_task: z.number().int().min(0).default(1),
  /** Backoff strategy (default: exponential) */
  backoff: z.enum(['none', 'linear', 'exponential']).default('exponential'),
  /** Base seconds for backoff calculation (default: 30) */
  backoff_base_seconds: z.number().positive().default(30),
  /** Include failure context in retry prompt (default: true) */
  include_failure_analysis: z.boolean().default(true),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * Recovery strategy for task failures.
 * Research basis: Reflexion 2023 - Self-correction with failure analysis +20-30% improvement
 */
export enum RecoveryStrategy {
  /** Simple retry without context */
  Retry = 'retry',
  /** Retry with failure context included in prompt (Reflexion pattern) */
  Revise = 'revise',
  /** Rollback to last known good state */
  Rollback = 'rollback',
  /** Create alternative execution path */
  Branch = 'branch',
  /** Escalate to human via gate */
  Escalate = 'escalate',
  /** Skip the task and continue */
  Skip = 'skip',
}

export const RecoveryStrategySchema = z.nativeEnum(RecoveryStrategy);

/**
 * Parallelism configuration for concurrent task execution
 */
export const ParallelismConfigSchema = z.object({
  /** Maximum concurrent tasks across run (default: 5) */
  max_concurrent_tasks: z.number().int().positive().default(5),
  /** Maximum concurrent tasks per scope (default: 2) */
  max_concurrent_per_scope: z.number().int().positive().default(2),
  /** Prefer sequential execution within same scope (default: true — prevents file conflicts in shared worktrees) */
  prefer_sequential_in_scope: z.boolean().default(true),
});

export type ParallelismConfig = z.infer<typeof ParallelismConfigSchema>;

/**
 * Replan configuration for cascade failure handling
 */
export const ReplanConfigSchema = z.object({
  /** Trigger replan on cascade failure (default: false) */
  on_cascade_failure: z.boolean().default(false),
  /** Number of blocked tasks before triggering replan (default: 3) */
  threshold_blocked_tasks: z.number().int().positive().default(3),
});

export type ReplanConfig = z.infer<typeof ReplanConfigSchema>;

/**
 * Confidence threshold configuration for control flow
 * Research basis: Multi-Agent Taxonomy 2025 - 98% of silent failures detectable with validation
 */
export const ConfidenceConfigSchema = z.object({
  /** Confidence below this triggers immediate failure (default: 0.3) */
  escalation_threshold: z.number().min(0).max(1).default(0.3),
  /** Confidence below this triggers review/clarification (default: 0.5) */
  review_threshold: z.number().min(0).max(1).default(0.5),
});

export type ConfidenceConfig = z.infer<typeof ConfidenceConfigSchema>;

/**
 * Quality gate configuration for PREP/POST phases.
 * Controls automated analysis at tier boundaries and after task completion.
 */
export const QualityConfigSchema = z.object({
  /** Run PREP analysis at tier boundaries (default: true) */
  prep_enabled: z.boolean().default(true),
  /** Run TASK_POST verification after each task (default: true) */
  task_post_enabled: z.boolean().default(true),
  /** Run RUN_POST integration review after all tasks (default: true) */
  run_post_enabled: z.boolean().default(true),
  /** Model for PREP analysis — deep codebase analysis benefits from stronger model */
  prep_model: z.string().default('sonnet'),
  /** Model for TASK_POST — fast quarter-review, haiku is sufficient */
  task_post_model: z.string().default('haiku'),
  /** Model for RUN_POST — integration review with focused prompt */
  run_post_model: z.string().default('haiku'),
  /** Skip PREP for runs with fewer tasks than this (default: 3) */
  prep_min_tasks: z.number().int().min(1).default(3),
  /** Skip PREP for tiers with fewer tasks than this (default: 2) */
  prep_min_tier_tasks: z.number().int().min(1).default(2),
  /** PREP timeout in milliseconds (default: 90000 = 90s) */
  prep_timeout_ms: z.number().int().min(30000).default(90000),
});

export type QualityConfig = z.infer<typeof QualityConfigSchema>;

/**
 * ExecutionPolicy controls all DOT Framework knobs for a run.
 * All fields are optional with sensible defaults to maintain backward compatibility.
 */
export const ExecutionPolicySchema = z.object({
  /** Budget limits (time, tokens, cost) */
  budgets: BudgetsConfigSchema.default({}),
  /** Retry strategy configuration */
  retry: RetryConfigSchema.default({}),
  /** Parallelism limits */
  parallelism: ParallelismConfigSchema.default({}),
  /** Replan triggers */
  replan: ReplanConfigSchema.default({}),
  /** Confidence thresholds */
  confidence: ConfidenceConfigSchema.default({}),
  /** Quality gate configuration for PREP/POST phases */
  quality: QualityConfigSchema.default({}),
});

export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

/**
 * Default execution policy with research-backed values
 */
export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = ExecutionPolicySchema.parse({});

// ============================================
// Run Entity
// ============================================

export const RunSchema = z.object({
  run_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int().positive(),
  status: RunStatusSchema,
  has_pending_gate: z.boolean(),
  /** DOT Framework execution policy (optional for backward compatibility) */
  execution_policy: ExecutionPolicySchema.optional(),
  /** Workspace directory for agent execution (propagated to all tasks) */
  workspace_path: z.string().optional(),
  /** Parent run ID if this run was spawned by a task in another run (hierarchical runs) */
  parent_run_id: z.string().uuid().optional(),
  /** Parent task ID that spawned this run (hierarchical runs) */
  parent_task_id: z.string().uuid().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Run = z.infer<typeof RunSchema>;

// ============================================
// Task Entity
// ============================================

/**
 * Reference to an artifact expected or produced by a task.
 * Used for artifact-based dependency validation.
 */
export const ArtifactReferenceSchema = z.object({
  /** Artifact type (file, code_change, test_result, etc.) */
  type: ArtifactTypeSchema,
  /** Reference path or identifier (e.g., file path, function name) */
  reference: z.string().min(1),
  /** Whether this artifact is required (true) or optional (false) */
  required: z.boolean().optional().default(true),
});

export type ArtifactReference = z.infer<typeof ArtifactReferenceSchema>;

export const TaskSchema = z.object({
  task_id: z.string().uuid(),
  run_id: z.string().uuid(),
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  status: TaskStatusSchema,
  dependencies: z.array(z.string()),
  /** Scope from plan step (for parallelism control and repo mapping) */
  scope: z.string().optional(),
  /** Owner role from plan step (for CLI/model mapping) */
  owner_role: z.string().optional(),
  /** Step description from plan step */
  step_description: z.string().optional(),
  /** Acceptance criteria from plan step */
  acceptance_criteria: z.array(AcceptanceCriterionSchema).optional(),
  workspace_path: z.string().optional(),
  agent_id: z.string().optional(),
  current_attempt: z.number().int().optional(),
  gate_id: z.string().uuid().optional(),
  /** Artifacts this task expects/requires as input (for dependency validation) */
  input_artifacts: z.array(ArtifactReferenceSchema).optional(),
  /** Artifacts this task produces as output (for dependency validation) */
  output_artifacts: z.array(ArtifactReferenceSchema).optional(),
  /** Reference to a sub-plan that this step expands into (creates child Run) */
  sub_plan_id: z.string().uuid().optional(),
  /** Run ID of the child run created for this task (when sub_plan_id is set) */
  child_run_id: z.string().uuid().optional(),
  /** Implementation specification from planner (target files, patterns, architecture) */
  specification: z.record(z.string(), z.unknown()).optional(),
  /** Target directory within workspace where agent should create files */
  target_path: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;

// ============================================
// TaskAttempt Entity
// ============================================

export const AuditFindingSchema = z.object({
  criterion_id: z.string().min(1),
  status: z.enum(['pass', 'fail']),
  details: z.string(),
});

export type AuditFinding = z.infer<typeof AuditFindingSchema>;

export const TaskAttemptSchema = z.object({
  attempt_id: z.string().uuid(),
  task_id: z.string().uuid(),
  attempt_number: z.number().int().positive(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  outcome: AttemptOutcomeSchema.optional(),
  error: z.string().optional(),
  agent_id: z.string().optional(),
  audit_findings: z.array(AuditFindingSchema).optional(),
});

export type TaskAttempt = z.infer<typeof TaskAttemptSchema>;

// ============================================
// Artifact Entity
// ============================================

export const ArtifactSchema = z.object({
  artifact_id: z.string().uuid(),
  task_id: z.string().uuid(),
  type: ArtifactTypeSchema,
  reference: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

// ============================================
// Gate Entity
// ============================================

export const GateSchema = z.object({
  gate_id: z.string().uuid(),
  task_id: z.string().uuid(),
  status: GateStatusSchema,
  approver_role: z.string().optional(),
  decided_by: z.string().optional(),
  decided_at: z.string().datetime().optional(),
  comment: z.string().optional(),
  created_at: z.string().datetime(),
});

export type Gate = z.infer<typeof GateSchema>;

// ============================================
// Question Entity
// ============================================

export const QuestionSchema = z.object({
  question_id: z.string().uuid(),
  run_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  agent_id: z.string().min(1),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  blocking_level: QuestionBlockingLevelSchema,
  /** Number of steps/tasks that are blocked waiting for this answer */
  steps_blocked: z.number().int().default(0),
  /** Depth of dependency cascade affected by this question */
  cascade_depth: z.number().int().default(0),
  /** Whether a default value can be used after timeout */
  can_use_default: z.boolean().default(false),
  /** Default value to use if timeout occurs and can_use_default is true */
  default_value: z.string().optional(),
  /** List of agent IDs subscribed to this question's answer */
  subscribers: z.array(z.string()).default([]),
  status: QuestionStatusSchema,
  answer: z.string().optional(),
  /** Calculated priority score for queue ordering */
  priority_score: z.number().int(),
  /** Who answered the question (human ID or 'system' for auto-answers) */
  answered_by: z.string().optional(),
  created_at: z.string().datetime(),
  answered_at: z.string().datetime().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

// ============================================
// Checkpoint Entity (for durability)
// ============================================

/**
 * Snapshot of a single task's state for checkpointing
 */
export const TaskSnapshotSchema = z.object({
  task_id: z.string().uuid(),
  step_id: z.string().min(1),
  status: TaskStatusSchema,
  current_attempt: z.number().int().optional(),
  agent_id: z.string().optional(),
  gate_id: z.string().uuid().optional(),
});

export type TaskSnapshot = z.infer<typeof TaskSnapshotSchema>;

/**
 * Full snapshot of run state for checkpoint recovery
 */
export const CheckpointSnapshotSchema = z.object({
  run_status: RunStatusSchema,
  has_pending_gate: z.boolean(),
  tasks_snapshot: z.array(TaskSnapshotSchema),
  active_agents: z.array(z.string()),
  pending_gates: z.array(z.string().uuid()).optional(),
});

export type CheckpointSnapshot = z.infer<typeof CheckpointSnapshotSchema>;

export const CheckpointSchema = z.object({
  checkpoint_id: z.string().uuid(),
  run_id: z.string().uuid(),
  run_status: RunStatusSchema,
  has_pending_gate: z.boolean(),
  tasks_snapshot: z.array(TaskSnapshotSchema),
  active_agents: z.array(z.string()),
  snapshot: z.record(z.unknown()), // Legacy field for additional data
  created_at: z.string().datetime(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

// ============================================
// Trajectory Event Entity
// ============================================

export const TrajectoryEventSchema = z.object({
  event_id: z.string().uuid(),
  run_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  event_type: z.string().min(1),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

export type TrajectoryEvent = z.infer<typeof TrajectoryEventSchema>;

// ============================================
// Workspace Cleanup Entry
// ============================================

export const WorkspaceCleanupSchema = z.object({
  task_id: z.string().uuid(),
  cleanup_after: z.string().datetime(),
});

export type WorkspaceCleanup = z.infer<typeof WorkspaceCleanupSchema>;

// ============================================
// Guardian Event Concern Level
// ============================================

/**
 * Concern level for guardian events:
 * - info: informational observation, no action needed
 * - warning: potential issue, should be reviewed
 * - critical: serious issue requiring immediate attention
 */
export const GuardianConcernLevel = {
  Info: 'info',
  Warning: 'warning',
  Critical: 'critical',
} as const;

export type GuardianConcernLevel =
  (typeof GuardianConcernLevel)[keyof typeof GuardianConcernLevel];

export const GuardianConcernLevelSchema = z.enum(['info', 'warning', 'critical']);

// ============================================
// Guardian Status
// ============================================

/**
 * Status of a guardian agent:
 * - active: running and observing
 * - stopped: gracefully stopped
 * - error: stopped due to error
 */
export const GuardianStatus = {
  Active: 'active',
  Stopped: 'stopped',
  Error: 'error',
} as const;

export type GuardianStatus = (typeof GuardianStatus)[keyof typeof GuardianStatus];

export const GuardianStatusSchema = z.enum(['active', 'stopped', 'error']);

// ============================================
// Guardian Event Entity
// ============================================

export const GuardianEventSchema = z.object({
  event_id: z.string().uuid(),
  project_id: z.string().min(1),
  guardian_type: z.enum(['Security', 'Architect', 'QA', 'Compliance']),
  observation: z.string().min(1),
  concern_level: GuardianConcernLevelSchema,
  recommendation: z.string().optional(),
  timestamp: z.string().datetime(),
  run_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  worker_agent_id: z.string().optional(),
  trigger_type: z.string().optional(),
  intervention_taken: z.string().optional(),
});

export type GuardianEvent = z.infer<typeof GuardianEventSchema>;

// ============================================
// Active Guardian Entity
// ============================================

export const ActiveGuardianSchema = z.object({
  guardian_id: z.string().uuid(),
  project_id: z.string().min(1),
  guardian_type: z.enum(['Security', 'Architect', 'QA', 'Compliance']),
  agent_name: z.string().min(1),
  status: GuardianStatusSchema,
  shadow_targets: z.array(z.string()),
  speak_on: z.array(z.string()),
  spawned_at: z.string().datetime(),
  stopped_at: z.string().datetime().optional(),
  error: z.string().optional(),
});

export type ActiveGuardian = z.infer<typeof ActiveGuardianSchema>;

// ============================================
// Factory Functions
// ============================================

/**
 * Options for creating a Run
 */
export interface CreateRunOptions {
  /** Optional execution policy for DOT Framework knobs */
  executionPolicy?: ExecutionPolicy;
  /** Workspace directory for agent execution */
  workspacePath?: string;
  /** Parent run ID if this run was spawned by a task in another run */
  parentRunId?: string;
  /** Parent task ID that spawned this run */
  parentTaskId?: string;
}

/**
 * Creates a new Run from a ForgePlan
 */
export function createRun(forgePlan: ForgePlan, options?: CreateRunOptions): Run {
  const now = new Date().toISOString();
  const run: Run = {
    run_id: crypto.randomUUID(),
    plan_id: forgePlan.plan_id,
    plan_version: forgePlan.version,
    status: RunStatus.Pending,
    has_pending_gate: false,
    execution_policy: options?.executionPolicy,
    workspace_path: options?.workspacePath,
    parent_run_id: options?.parentRunId,
    parent_task_id: options?.parentTaskId,
    created_at: now,
    updated_at: now,
  };
  return RunSchema.parse(run);
}

/**
 * Creates a new Task from a ForgeStep
 */
export function createTask(runId: string, forgeStep: ForgeStep, workspacePath?: string): Task {
  const now = new Date().toISOString();
  const task: Task = {
    task_id: crypto.randomUUID(),
    run_id: runId,
    step_id: forgeStep.step_id,
    step_title: forgeStep.title,
    status: TaskStatus.Pending,
    dependencies: forgeStep.dependencies,
    scope: forgeStep.scope,
    owner_role: forgeStep.owner_role,
    workspace_path: workspacePath,
    step_description: forgeStep.description,
    acceptance_criteria: forgeStep.acceptance_criteria,
    sub_plan_id: forgeStep.sub_plan_id,
    specification: forgeStep.specification,
    target_path: forgeStep.target_path,
    created_at: now,
    updated_at: now,
  };
  return TaskSchema.parse(task);
}

/**
 * Creates a new TaskAttempt
 */
export function createTaskAttempt(taskId: string, attemptNumber: number): TaskAttempt {
  const now = new Date().toISOString();
  const attempt: TaskAttempt = {
    attempt_id: crypto.randomUUID(),
    task_id: taskId,
    attempt_number: attemptNumber,
    started_at: now,
  };
  return TaskAttemptSchema.parse(attempt);
}

/**
 * Creates a new Artifact
 */
export function createArtifact(
  taskId: string,
  type: ArtifactType,
  reference: string,
  metadata?: Record<string, unknown>
): Artifact {
  const now = new Date().toISOString();
  const artifact: Artifact = {
    artifact_id: crypto.randomUUID(),
    task_id: taskId,
    type,
    reference,
    metadata,
    created_at: now,
  };
  return ArtifactSchema.parse(artifact);
}

/**
 * Creates a new Gate for a task
 */
export function createGate(taskId: string, approverRole?: string): Gate {
  const now = new Date().toISOString();
  const gate: Gate = {
    gate_id: crypto.randomUUID(),
    task_id: taskId,
    status: GateStatus.Pending,
    approver_role: approverRole,
    created_at: now,
  };
  return GateSchema.parse(gate);
}

/**
 * Options for creating a question
 */
export interface CreateQuestionOptions {
  taskId?: string;
  /** Multiple choice options */
  options?: string[];
  /** Number of steps blocked by this question */
  stepsBlocked?: number;
  /** Cascade depth of affected dependencies */
  cascadeDepth?: number;
  /** Whether default value can be used on timeout */
  canUseDefault?: boolean;
  /** Default value to use on timeout */
  defaultValue?: string;
  /** Initial subscribers (agent IDs) */
  subscribers?: string[];
  /** Override calculated priority score */
  priorityScore?: number;
  /** Initial status (for auto-answered questions) */
  status?: QuestionStatus;
  /** Answer (for auto-answered questions) */
  answer?: string;
  /** Who answered (for auto-answered questions) */
  answeredBy?: string;
}

/**
 * Blocking level values for priority calculation
 */
export const BLOCKING_LEVEL_VALUES: Record<QuestionBlockingLevel, number> = {
  [QuestionBlockingLevel.HardBlock]: 3,
  [QuestionBlockingLevel.SoftBlock]: 2,
  [QuestionBlockingLevel.Preference]: 1,
  [QuestionBlockingLevel.FYI]: 0,
};

/**
 * Calculates priority score for a question.
 *
 * Formula: blocking_level_value*100 + steps_blocked*10 + subscribers.length*15 + cascade_depth*5 - (can_use_default ? 30 : 0)
 *
 * Higher scores = higher priority (sorted DESC in queue)
 */
export function calculateQuestionPriorityScore(
  blockingLevel: QuestionBlockingLevel,
  stepsBlocked: number,
  subscribersCount: number,
  cascadeDepth: number,
  canUseDefault: boolean
): number {
  const blockingValue = BLOCKING_LEVEL_VALUES[blockingLevel];
  return (
    blockingValue * 100 +
    stepsBlocked * 10 +
    subscribersCount * 15 +
    cascadeDepth * 5 -
    (canUseDefault ? 30 : 0)
  );
}

/**
 * Creates a new Question with calculated priority score
 */
export function createQuestion(
  runId: string,
  agentId: string,
  text: string,
  blockingLevel: QuestionBlockingLevel,
  options?: CreateQuestionOptions
): Question {
  const now = new Date().toISOString();

  const stepsBlocked = options?.stepsBlocked ?? 0;
  const cascadeDepth = options?.cascadeDepth ?? 0;
  const canUseDefault = options?.canUseDefault ?? false;
  const subscribers = options?.subscribers ?? [];

  // Calculate priority score if not explicitly provided
  const priorityScore =
    options?.priorityScore ??
    calculateQuestionPriorityScore(
      blockingLevel,
      stepsBlocked,
      subscribers.length,
      cascadeDepth,
      canUseDefault
    );

  const question: Question = {
    question_id: crypto.randomUUID(),
    run_id: runId,
    task_id: options?.taskId,
    agent_id: agentId,
    text,
    options: options?.options,
    blocking_level: blockingLevel,
    steps_blocked: stepsBlocked,
    cascade_depth: cascadeDepth,
    can_use_default: canUseDefault,
    default_value: options?.defaultValue,
    subscribers,
    status: options?.status ?? QuestionStatus.Pending,
    answer: options?.answer,
    answered_by: options?.answeredBy,
    priority_score: priorityScore,
    created_at: now,
    answered_at: options?.status && options.status !== QuestionStatus.Pending ? now : undefined,
  };
  return QuestionSchema.parse(question);
}

/**
 * Options for creating a checkpoint
 */
export interface CreateCheckpointOptions {
  runId: string;
  runStatus: RunStatus;
  hasPendingGate: boolean;
  tasksSnapshot: TaskSnapshot[];
  activeAgents: string[];
  additionalData?: Record<string, unknown>;
}

/**
 * Creates a new Checkpoint with full run state
 */
export function createCheckpoint(options: CreateCheckpointOptions): Checkpoint;
/**
 * @deprecated Use the options object overload instead
 * Creates a new Checkpoint (legacy signature for backward compatibility)
 */
export function createCheckpoint(
  runId: string,
  snapshot: Record<string, unknown>
): Checkpoint;
export function createCheckpoint(
  runIdOrOptions: string | CreateCheckpointOptions,
  legacySnapshot?: Record<string, unknown>
): Checkpoint {
  const now = new Date().toISOString();

  // Handle legacy signature
  if (typeof runIdOrOptions === 'string') {
    const checkpoint: Checkpoint = {
      checkpoint_id: crypto.randomUUID(),
      run_id: runIdOrOptions,
      run_status: RunStatus.Running, // Default for legacy
      has_pending_gate: false,
      tasks_snapshot: [],
      active_agents: [],
      snapshot: legacySnapshot ?? {},
      created_at: now,
    };
    return CheckpointSchema.parse(checkpoint);
  }

  // Handle new options signature
  const options = runIdOrOptions;
  const checkpoint: Checkpoint = {
    checkpoint_id: crypto.randomUUID(),
    run_id: options.runId,
    run_status: options.runStatus,
    has_pending_gate: options.hasPendingGate,
    tasks_snapshot: options.tasksSnapshot,
    active_agents: options.activeAgents,
    snapshot: options.additionalData ?? {},
    created_at: now,
  };
  return CheckpointSchema.parse(checkpoint);
}

/**
 * Creates a new TrajectoryEvent
 */
export function createTrajectoryEvent(
  runId: string,
  eventType: string,
  payload: Record<string, unknown>,
  taskId?: string
): TrajectoryEvent {
  const now = new Date().toISOString();
  const event: TrajectoryEvent = {
    event_id: crypto.randomUUID(),
    run_id: runId,
    task_id: taskId,
    event_type: eventType,
    payload,
    timestamp: now,
  };
  return TrajectoryEventSchema.parse(event);
}

/**
 * Options for creating a guardian event
 */
export interface CreateGuardianEventOptions {
  runId?: string;
  taskId?: string;
  workerAgentId?: string;
  triggerType?: string;
  interventionTaken?: string;
}

/**
 * Creates a new GuardianEvent
 */
export function createGuardianEvent(
  projectId: string,
  guardianType: 'Security' | 'Architect' | 'QA' | 'Compliance',
  observation: string,
  concernLevel: GuardianConcernLevel,
  recommendation?: string,
  options?: CreateGuardianEventOptions
): GuardianEvent {
  const now = new Date().toISOString();
  const event: GuardianEvent = {
    event_id: crypto.randomUUID(),
    project_id: projectId,
    guardian_type: guardianType,
    observation,
    concern_level: concernLevel,
    recommendation,
    timestamp: now,
    run_id: options?.runId,
    task_id: options?.taskId,
    worker_agent_id: options?.workerAgentId,
    trigger_type: options?.triggerType,
    intervention_taken: options?.interventionTaken,
  };
  return GuardianEventSchema.parse(event);
}

/**
 * Creates a new ActiveGuardian record
 */
export function createActiveGuardian(
  projectId: string,
  guardianType: 'Security' | 'Architect' | 'QA' | 'Compliance',
  agentName: string,
  shadowTargets: string[],
  speakOn: string[]
): ActiveGuardian {
  const now = new Date().toISOString();
  const guardian: ActiveGuardian = {
    guardian_id: crypto.randomUUID(),
    project_id: projectId,
    guardian_type: guardianType,
    agent_name: agentName,
    status: GuardianStatus.Active,
    shadow_targets: shadowTargets,
    speak_on: speakOn,
    spawned_at: now,
  };
  return ActiveGuardianSchema.parse(guardian);
}

// ============================================
// Task Execution Metric (DOT Framework)
// ============================================

/**
 * Detailed execution metrics for a task completion.
 * Used for Tuner learning and analytics.
 */
export const TaskExecutionMetricSchema = z.object({
  /** Unique identifier */
  metric_id: z.string().uuid(),
  /** Task this metric is for */
  task_id: z.string().uuid(),
  /** Run the task belongs to */
  run_id: z.string().uuid(),
  /** Model used for execution (haiku, sonnet, opus) */
  model_id: z.string().optional(),
  /** Complexity score from Planner (if available) */
  complexity_score: z.number().optional(),
  /** Duration in milliseconds */
  duration_ms: z.number().int().optional(),
  /** Tokens consumed */
  tokens_used: z.number().int().optional(),
  /** Cost in USD */
  cost_usd: z.number().optional(),
  /** Execution outcome */
  outcome: AttemptOutcomeSchema.optional(),
  /** Confidence reported by agent */
  confidence: z.number().min(0).max(1).optional(),
  /** When the metric was recorded */
  created_at: z.string().datetime(),
});

export type TaskExecutionMetric = z.infer<typeof TaskExecutionMetricSchema>;

/**
 * Options for creating a task execution metric
 */
export interface CreateTaskExecutionMetricOptions {
  taskId: string;
  runId: string;
  modelId?: string;
  complexityScore?: number;
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
  outcome?: AttemptOutcome;
  confidence?: number;
}

/**
 * Creates a new TaskExecutionMetric
 */
export function createTaskExecutionMetric(
  options: CreateTaskExecutionMetricOptions
): TaskExecutionMetric {
  const now = new Date().toISOString();
  const metric: TaskExecutionMetric = {
    metric_id: crypto.randomUUID(),
    task_id: options.taskId,
    run_id: options.runId,
    model_id: options.modelId,
    complexity_score: options.complexityScore,
    duration_ms: options.durationMs,
    tokens_used: options.tokensUsed,
    cost_usd: options.costUsd,
    outcome: options.outcome,
    confidence: options.confidence,
    created_at: now,
  };
  return TaskExecutionMetricSchema.parse(metric);
}

// ============================================
// State Transition Validators
// ============================================

/**
 * Valid state transitions for Run
 */
export const VALID_RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  [RunStatus.Pending]: [RunStatus.Running, RunStatus.Cancelled],
  [RunStatus.Running]: [
    RunStatus.Paused,
    RunStatus.Completed,
    RunStatus.Failed,
    RunStatus.Cancelled,
  ],
  [RunStatus.Paused]: [RunStatus.Running, RunStatus.Cancelled],
  [RunStatus.Completed]: [],
  [RunStatus.Failed]: [RunStatus.Running], // Retry: resume failed run
  [RunStatus.Cancelled]: [],
};

/**
 * Valid state transitions for Task
 */
export const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.Pending]: [TaskStatus.Queued, TaskStatus.Blocked],
  [TaskStatus.Queued]: [TaskStatus.Running],
  [TaskStatus.Running]: [
    TaskStatus.Auditing,
    TaskStatus.AwaitingApproval,
    TaskStatus.Completed,
    TaskStatus.Failed,
    TaskStatus.Blocked,
  ],
  [TaskStatus.Auditing]: [TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Pending],
  [TaskStatus.AwaitingApproval]: [TaskStatus.Completed, TaskStatus.Failed],
  [TaskStatus.Blocked]: [TaskStatus.Pending, TaskStatus.Failed],
  [TaskStatus.Completed]: [],
  [TaskStatus.Failed]: [TaskStatus.Pending],
};

/**
 * Validates a Run state transition
 * @throws Error if transition is invalid
 */
export function validateRunTransition(from: RunStatus, to: RunStatus): void {
  const validTransitions = VALID_RUN_TRANSITIONS[from];
  if (!validTransitions?.includes(to)) {
    throw new Error(
      `Invalid Run state transition: ${from} -> ${to}. ` +
        `Valid transitions from ${from}: [${validTransitions?.join(', ') ?? 'none'}]`
    );
  }
}

/**
 * Validates a Task state transition
 * @throws Error if transition is invalid
 */
export function validateTaskTransition(from: TaskStatus, to: TaskStatus): void {
  const validTransitions = VALID_TASK_TRANSITIONS[from];
  if (!validTransitions?.includes(to)) {
    throw new Error(
      `Invalid Task state transition: ${from} -> ${to}. ` +
        `Valid transitions from ${from}: [${validTransitions?.join(', ') ?? 'none'}]`
    );
  }
}

/**
 * Transitions a Run to a new status with validation
 */
export function transitionRun(run: Run, newStatus: RunStatus): Run {
  validateRunTransition(run.status, newStatus);
  const now = new Date().toISOString();
  const updates: Partial<Run> = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === RunStatus.Running && !run.started_at) {
    updates.started_at = now;
  }

  if (
    newStatus === RunStatus.Completed ||
    newStatus === RunStatus.Failed ||
    newStatus === RunStatus.Cancelled
  ) {
    updates.completed_at = now;
  }

  return { ...run, ...updates };
}

/**
 * Transitions a Task to a new status with validation
 */
export function transitionTask(task: Task, newStatus: TaskStatus): Task {
  validateTaskTransition(task.status, newStatus);
  const now = new Date().toISOString();
  return {
    ...task,
    status: newStatus,
    updated_at: now,
  };
}
