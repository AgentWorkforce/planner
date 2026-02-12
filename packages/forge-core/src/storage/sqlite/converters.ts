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
  Checkpoint,
  TrajectoryEvent,
  WorkspaceCleanup,
  Question,
  QuestionStatus,
  QuestionBlockingLevel,
  GuardianEvent,
  GuardianConcernLevel,
  ActiveGuardian,
  GuardianStatus,
  TaskExecutionMetric,
  AttemptOutcome,
  AuditFinding,
  AcceptanceCriterion,
  TaskSnapshot,
} from '../../domain/types.js';
import type { Build, BuildTier, BuildStatus, BuildRun, BuildRunStatus } from '../../domain/build-types.js';
import type {
  UserTrajectoryEvent,
  UserTrajectoryScope,
  DerivedPreference,
} from '../../domain/user-trajectory.js';

// ============================================
// Row types for database queries
// ============================================

export interface RunRow {
  run_id: string;
  plan_id: string;
  plan_version: number;
  status: string;
  has_pending_gate: number;
  workspace_path: string | null;
  parent_run_id: string | null;
  parent_task_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  document: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  task_id: string;
  run_id: string;
  step_id: string;
  step_title: string;
  status: string;
  dependencies: string;
  scope: string | null;
  owner_role: string | null;
  step_description: string | null;
  acceptance_criteria: string | null;
  workspace_path: string | null;
  agent_id: string | null;
  current_attempt: number | null;
  gate_id: string | null;
  sub_plan_id: string | null;
  child_run_id: string | null;
  specification: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAttemptRow {
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

export interface ArtifactRow {
  artifact_id: string;
  task_id: string;
  type: string;
  reference: string;
  metadata: string | null;
  created_at: string;
}

export interface GateRow {
  gate_id: string;
  task_id: string;
  status: string;
  approver_role: string | null;
  decided_by: string | null;
  decided_at: string | null;
  comment: string | null;
  created_at: string;
}

export interface WorkspaceCleanupRow {
  task_id: string;
  cleanup_after: string;
}

export interface CheckpointRow {
  checkpoint_id: string;
  run_id: string;
  run_status: string;
  has_pending_gate: number;
  tasks_snapshot: string;
  active_agents: string;
  snapshot: string;
  created_at: string;
}

export interface TrajectoryEventRow {
  event_id: string;
  run_id: string;
  task_id: string | null;
  event_type: string;
  payload: string;
  timestamp: string;
}

export interface QuestionRow {
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

export interface GuardianEventRow {
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

export interface ActiveGuardianRow {
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

export interface UserTrajectoryEventRow {
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

export interface DerivedPreferenceRow {
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

export interface TaskExecutionMetricRow {
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

export interface RunBudgetRow {
  run_id: string;
  tokens_allowed: number | null;
  tokens_used: number;
  cost_allowed_usd: number | null;
  cost_used_usd: number;
  updated_at: string;
}

export interface BuildRow {
  build_id: string;
  status: string;
  tiers_json: string;
  concurrency_limit: number;
  skip_completed: number;
  mode: string;
  workspace_path: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface BuildRunRow {
  build_id: string;
  run_id: string;
  plan_id: string;
  plan_version: number | null;
  tier: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Helper function for safe JSON parsing
// ============================================

function safeJsonParse<T>(json: string, fallback: T, context: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.warn(`Failed to parse JSON for ${context}, using fallback:`, err);
    return fallback;
  }
}

// ============================================
// Converter functions to transform database rows into domain entities
// ============================================

export function rowToRun(row: RunRow): Run {
  return {
    run_id: row.run_id,
    plan_id: row.plan_id,
    plan_version: row.plan_version,
    status: row.status as RunStatus,
    has_pending_gate: row.has_pending_gate === 1,
    workspace_path: row.workspace_path ?? undefined,
    parent_run_id: row.parent_run_id ?? undefined,
    parent_task_id: row.parent_task_id ?? undefined,
    started_at: row.started_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToTask(row: TaskRow): Task {
  return {
    task_id: row.task_id,
    run_id: row.run_id,
    step_id: row.step_id,
    step_title: row.step_title,
    status: row.status as TaskStatus,
    dependencies: safeJsonParse<string[]>(row.dependencies, [], `task ${row.task_id} dependencies`),
    scope: row.scope ?? undefined,
    owner_role: row.owner_role ?? undefined,
    step_description: row.step_description ?? undefined,
    acceptance_criteria: row.acceptance_criteria
      ? safeJsonParse<AcceptanceCriterion[]>(row.acceptance_criteria, [], `task ${row.task_id} acceptance_criteria`)
      : undefined,
    workspace_path: row.workspace_path ?? undefined,
    agent_id: row.agent_id ?? undefined,
    current_attempt: row.current_attempt ?? undefined,
    gate_id: row.gate_id ?? undefined,
    sub_plan_id: row.sub_plan_id ?? undefined,
    child_run_id: row.child_run_id ?? undefined,
    specification: row.specification
      ? safeJsonParse<Record<string, unknown>>(row.specification, {}, `task ${row.task_id} specification`)
      : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToAttempt(row: TaskAttemptRow): TaskAttempt {
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

export function rowToArtifact(row: ArtifactRow): Artifact {
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

export function rowToGate(row: GateRow): Gate {
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

export function rowToCheckpoint(row: CheckpointRow): Checkpoint {
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

export function rowToTrajectoryEvent(row: TrajectoryEventRow): TrajectoryEvent {
  return {
    event_id: row.event_id,
    run_id: row.run_id,
    task_id: row.task_id ?? undefined,
    event_type: row.event_type,
    payload: safeJsonParse<Record<string, unknown>>(row.payload, {}, `trajectory event ${row.event_id} payload`),
    timestamp: row.timestamp,
  };
}

export function rowToQuestion(row: QuestionRow): Question {
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

export function rowToUserTrajectoryEvent(row: UserTrajectoryEventRow): UserTrajectoryEvent {
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

export function rowToDerivedPreference(row: DerivedPreferenceRow): DerivedPreference {
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

export function rowToGuardianEvent(row: GuardianEventRow): GuardianEvent {
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

export function rowToActiveGuardian(row: ActiveGuardianRow): ActiveGuardian {
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

export function rowToTaskExecutionMetric(row: TaskExecutionMetricRow): TaskExecutionMetric {
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

export function rowToBuild(row: BuildRow): Build {
  return {
    build_id: row.build_id,
    status: row.status as BuildStatus,
    tiers: safeJsonParse<BuildTier[]>(row.tiers_json, [], `build ${row.build_id} tiers_json`),
    concurrency_limit: row.concurrency_limit,
    skip_completed: row.skip_completed === 1,
    mode: row.mode,
    workspace_path: row.workspace_path,
    error: row.error,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  };
}

export function rowToBuildRun(row: BuildRunRow): BuildRun {
  return {
    build_id: row.build_id,
    run_id: row.run_id,
    plan_id: row.plan_id,
    plan_version: row.plan_version,
    tier: row.tier,
    status: row.status as BuildRunStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
