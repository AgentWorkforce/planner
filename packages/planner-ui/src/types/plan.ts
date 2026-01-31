export type PlanStatus = 'draft' | 'approved' | 'published';

/**
 * Attention types that indicate what action a plan needs.
 * These are computed from plan state and related data.
 */
export type AttentionType =
  | 'awaiting_approval'
  | 'change_request'
  | 'gate_pending'
  | 'execution_failed'
  | 'unread_comments'
  | 'stale_draft'
  | 'active'
  | 'none';

export interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

export interface Gate {
  type: 'human_approval';
  approver_role?: string;
}

export interface Step {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: Gate;
  sub_plan_id?: string;
}

export interface Summary {
  goal: string;
  context?: string;
}

export interface ApprovalInfo {
  approver: string;
  approved_at: string;
}

export interface Plan {
  plan_id: string;
  created_at: string;
  updated_at: string;
}

export interface PlanVersion {
  plan_id: string;
  version: number;
  status: PlanStatus;
  summary: Summary;
  steps: Step[];
  submitted_at?: string;
  approval_info?: ApprovalInfo;
  change_request_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PlanWithVersion {
  plan: Plan;
  version: PlanVersion;
}

export interface InitiativeBadgeData {
  initiative_id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface PlanSummary {
  plan_id: string;
  goal: string;
  status: PlanStatus;
  latest_version: number;
  scopes?: string[];
  created_at: string;
  updated_at: string;
  /** Attention types computed by backend when include_attention=true */
  attention_types?: AttentionType[];
  /** Initiative association */
  initiative_id?: string;
  initiative?: InitiativeBadgeData;
  /** Organization association */
  org_id?: string;
  /** Owner user ID for "My Plans" filtering */
  owner_user_id?: string;
}

// Navigation state for sub-plan breadcrumbs
export interface ParentPlanInfo {
  plan_id: string;
  goal: string;
}

export interface SubPlanNavigationState {
  parents: ParentPlanInfo[];
}

// Execution status (from orchestrator)
export type StepExecutionStatus = 'pending' | 'running' | 'done' | 'blocked' | 'failed';

export interface StepExecutionInfo {
  step_id: string;
  status: StepExecutionStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface ExecutionStatus {
  plan_id: string;
  version: number;
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: StepExecutionInfo[];
  progress: {
    total: number;
    done: number;
    running: number;
    pending: number;
    blocked: number;
    failed: number;
  };
  started_at?: string;
  completed_at?: string;
}

// Type guards for execution status
export function isStepDone(status: StepExecutionStatus): boolean {
  return status === 'done';
}

export function isStepRunning(status: StepExecutionStatus): boolean {
  return status === 'running';
}

export function isStepBlocked(status: StepExecutionStatus): boolean {
  return status === 'blocked';
}

export function isStepFailed(status: StepExecutionStatus): boolean {
  return status === 'failed';
}

export function isStepPending(status: StepExecutionStatus): boolean {
  return status === 'pending';
}

// Review comments
export interface Comment {
  comment_id: string;
  plan_id: string;
  version: number;
  step_id: string;
  parent_id: string | null;
  author: string;
  content: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// AI Chat types
export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  suggestion?: ChatSuggestion;
}

export interface ChatSuggestion {
  id: string;
  type: 'add_step' | 'edit_step' | 'add_criteria' | 'edit_goal' | 'edit_context';
  description: string;
  preview: string;
  data: Record<string, unknown>;
  status: 'pending' | 'applied' | 'dismissed';
}

// AI Improvement types
export type ImprovementType = 'criteria' | 'dependencies' | 'description' | 'scope';

export type ImprovementStatus = 'applied' | 'undone';

export interface Improvement {
  id: string;
  type: ImprovementType;
  step_id: string;
  description: string;
  before: unknown;
  after: unknown;
  status: ImprovementStatus;
  timestamp: string;
}

// Flagged concern (issues needing human decision)
export type ConcernSeverity = 'info' | 'warning' | 'error';

export interface FlaggedConcern {
  id: string;
  step_id: string;
  severity: ConcernSeverity;
  title: string;
  description: string;
  suggestions?: string[];
  dismissed: boolean;
  timestamp: string;
}

// Activity log entry
export type ActivityType = 'user_edit' | 'ai_improvement' | 'ai_concern' | 'undo';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  description: string;
  step_id?: string;
  improvement_id?: string;
  timestamp: string;
}

// Gate approval types
export type GateApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface GateApprovalInfo {
  step_id: string;
  step_title: string;
  gate_type: 'human_approval';
  approver_role?: string;
  status: GateApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface PendingGate {
  step_id: string;
  step_title: string;
  step_description?: string;
  gate: Gate;
  blocked_since: string;
}

// Change Request types (from orchestrator)
export type ChangeRequestStatus = 'pending' | 'applied' | 'rejected';

export interface StepModification {
  step_id: string;
  title?: string;
  description?: string;
  scope?: string;
  owner_role?: string;
  dependencies?: string[];
}

export interface SuggestedChanges {
  add_steps?: Step[];
  modify_steps?: StepModification[];
  remove_steps?: string[];
}

/** Revision agent status for change requests */
export type RevisionStatus = 'none' | 'pending' | 'in_progress' | 'drafted' | 'error';

export interface ChangeRequest {
  change_request_id: string;
  run_id: string;
  plan_id: string;
  reason: string;
  suggested_changes: SuggestedChanges;
  status: ChangeRequestStatus;
  result_version?: number;
  /** Revision agent session ID (if agent was spawned) */
  revision_session_id?: string;
  /** Status of AI-assisted revision */
  revision_status?: RevisionStatus;
  created_at: string;
  updated_at: string;
}

// Question Queue types
export type QuestionBlockingLevel = 'hard_block' | 'soft_block' | 'preference' | 'fyi';
export type QuestionStatus = 'pending' | 'answered' | 'dismissed';

/**
 * Question from an agent awaiting human answer.
 * Questions are prioritized by blocking level, steps blocked, subscribers, and wait time.
 */
export interface Question {
  question_id: string;
  plan_id: string;
  agent_id: string;
  agent_role: string;
  text: string;
  context?: string;
  /** Multiple choice options (if any) */
  options?: string[];
  blocking_level: QuestionBlockingLevel;
  /** Number of steps blocked by this question */
  steps_blocked: number;
  /** Whether the agent can proceed with a default value */
  can_use_default: boolean;
  /** Default value if can_use_default is true */
  default_value?: string;
  /** Other agent IDs waiting for this answer */
  subscribers: string[];
  /** Question IDs that were deduplicated/merged into this one */
  merged_from: string[];
  status: QuestionStatus;
  answer?: string;
  answered_at?: string;
  /** Computed priority score for queue ordering */
  priority_score: number;
  created_at: string;
  updated_at: string;
}

/**
 * State for the question queue UI.
 */
export interface QuestionQueueState {
  questions: Question[];
  currentQuestion: Question | null;
  isTriageOpen: boolean;
  lastUpdated: string;
}
