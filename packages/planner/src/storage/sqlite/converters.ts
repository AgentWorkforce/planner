import type { Plan, PlanVersion, PlanSource, Understanding } from '../../domain/plan.js';
import type { Step } from '../../domain/step.js';
import type { Summary } from '../../domain/summary.js';
import type { PlanStatus } from '../../domain/status.js';
import type { ApprovalInfo } from '../../domain/workflow.js';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  RevisionStatus,
  SuggestedChanges,
} from '../../domain/change-request.js';
import type { Comment } from '../../domain/comment.js';
import type {
  Improvement,
  ImprovementType,
  ImprovementStatus,
} from '../../domain/improvement.js';
import type { Organization, Initiative } from '../../domain/organization.js';
import type {
  Question,
  QuestionBlockingLevel,
  QuestionStatus,
} from '../../domain/question.js';
import type { DecisionEvent } from '../../domain/trajectory.js';
import type { Session, SessionStatus } from '../interface.js';

/**
 * Row types for database queries
 */
export interface OrganizationRow {
  org_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface InitiativeRow {
  initiative_id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  icon: string | null;
  color: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  plan_id: string;
  org_id: string;
  initiative_id: string | null;
  owner_user_id: string | null;
  source_json: string;
  created_at: string;
  updated_at: string;
}

export interface VersionRow {
  plan_id: string;
  version: number;
  status: string;
  summary_json: string;
  understanding_json: string | null;
  submitted_at: string | null;
  approval_info_json: string | null;
  change_request_id: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepRow {
  plan_id: string;
  version: number;
  step_id: string;
  step_order: number;
  step_json: string;
}

export interface ChangeRequestRow {
  change_request_id: string;
  run_id: string;
  plan_id: string;
  reason: string;
  suggested_changes_json: string;
  status: string;
  result_version: number | null;
  revision_session_id: string | null;
  revision_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  comment_id: string;
  plan_id: string;
  version: number;
  step_id: string;
  parent_id: string | null;
  author: string;
  content: string;
  resolved: number;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  session_id: string;
  token: string;
  plan_id: string;
  agent_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ImprovementRow {
  improvement_id: string;
  plan_id: string;
  version: number;
  step_id: string | null;
  type: string;
  description: string;
  suggested_change_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionRow {
  question_id: string;
  plan_id: string;
  agent_id: string;
  agent_role: string;
  text: string;
  context: string | null;
  options_json: string | null;
  blocking_level: string;
  steps_blocked: number;
  can_use_default: number;
  default_value: string | null;
  subscribers_json: string;
  merged_from_json: string;
  status: string;
  answer: string | null;
  answered_at: string | null;
  priority_score: number;
  created_at: string;
  updated_at: string;
}

export interface TrajectoryEventRow {
  event_id: string;
  type: string;
  question_id: string;
  asking_agent: string;
  question_text: string;
  context_provided: string | null;
  options_presented_json: string;
  selected_option: string | null;
  free_text_response: string | null;
  reasoning: string | null;
  plan_id: string;
  step_id: string | null;
  agent_trajectory_ref: string | null;
  timestamp: string;
}

/**
 * Converter functions to transform database rows into domain entities
 */

export function rowToOrganization(row: OrganizationRow): Organization {
  return {
    org_id: row.org_id,
    name: row.name,
    slug: row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToInitiative(row: InitiativeRow): Initiative {
  return {
    initiative_id: row.initiative_id,
    org_id: row.org_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Initiative['status'],
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToPlan(row: PlanRow): Plan {
  return {
    plan_id: row.plan_id,
    org_id: row.org_id,
    initiative_id: row.initiative_id ?? undefined,
    owner_user_id: row.owner_user_id ?? undefined,
    source: JSON.parse(row.source_json) as PlanSource,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToVersion(row: VersionRow, steps: Step[]): PlanVersion {
  const understanding = row.understanding_json
    ? (JSON.parse(row.understanding_json) as Understanding)
    : undefined;
  const version: PlanVersion = {
    plan_id: row.plan_id,
    version: row.version,
    status: row.status as PlanStatus,
    summary: JSON.parse(row.summary_json) as Summary,
    steps,
    understanding: understanding && Object.keys(understanding).length > 0 ? understanding : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.submitted_at) {
    version.submitted_at = row.submitted_at;
  }
  if (row.approval_info_json) {
    version.approval_info = JSON.parse(row.approval_info_json) as ApprovalInfo;
  }
  if (row.metadata_json) {
    version.metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
  }
  if (row.change_request_id) {
    version.change_request_id = row.change_request_id;
  }
  return version;
}

export function rowToChangeRequest(row: ChangeRequestRow): ChangeRequest {
  const changeRequest: ChangeRequest = {
    change_request_id: row.change_request_id,
    run_id: row.run_id,
    plan_id: row.plan_id,
    reason: row.reason,
    suggested_changes: JSON.parse(row.suggested_changes_json) as SuggestedChanges,
    status: row.status as ChangeRequestStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.result_version !== null) {
    changeRequest.result_version = row.result_version;
  }
  if (row.revision_session_id !== null) {
    changeRequest.revision_session_id = row.revision_session_id;
  }
  if (row.revision_status !== null) {
    changeRequest.revision_status = row.revision_status as RevisionStatus;
  }
  return changeRequest;
}

export function rowToComment(row: CommentRow): Comment {
  return {
    comment_id: row.comment_id,
    plan_id: row.plan_id,
    version: row.version,
    step_id: row.step_id,
    parent_id: row.parent_id,
    author: row.author,
    content: row.content,
    resolved: row.resolved === 1,
    resolved_by: row.resolved_by,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToSession(row: SessionRow): Session {
  return {
    session_id: row.session_id,
    token: row.token,
    plan_id: row.plan_id,
    agent_id: row.agent_id,
    status: row.status as SessionStatus,
    started_at: row.started_at,
    ended_at: row.ended_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

export function rowToImprovement(row: ImprovementRow): Improvement {
  return {
    improvement_id: row.improvement_id,
    plan_id: row.plan_id,
    version: row.version,
    step_id: row.step_id ?? undefined,
    type: row.type as ImprovementType,
    description: row.description,
    suggested_change: row.suggested_change_json
      ? (JSON.parse(row.suggested_change_json) as Record<string, unknown>)
      : undefined,
    status: row.status as ImprovementStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToQuestion(row: QuestionRow): Question {
  return {
    question_id: row.question_id,
    plan_id: row.plan_id,
    agent_id: row.agent_id,
    agent_role: row.agent_role,
    text: row.text,
    context: row.context ?? undefined,
    options: row.options_json ? (JSON.parse(row.options_json) as string[]) : undefined,
    blocking_level: row.blocking_level as QuestionBlockingLevel,
    steps_blocked: row.steps_blocked,
    can_use_default: row.can_use_default === 1,
    default_value: row.default_value ?? undefined,
    subscribers: JSON.parse(row.subscribers_json) as string[],
    merged_from: JSON.parse(row.merged_from_json) as string[],
    status: row.status as QuestionStatus,
    answer: row.answer ?? undefined,
    answered_at: row.answered_at ?? undefined,
    priority_score: row.priority_score,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToTrajectoryEvent(row: TrajectoryEventRow): DecisionEvent {
  return {
    event_id: row.event_id,
    type: row.type as 'decision',
    question_id: row.question_id,
    asking_agent: row.asking_agent,
    question_text: row.question_text,
    context_provided: row.context_provided ?? undefined,
    options_presented: JSON.parse(row.options_presented_json),
    selected_option: row.selected_option,
    free_text_response: row.free_text_response ?? undefined,
    reasoning: row.reasoning ?? undefined,
    plan_id: row.plan_id,
    step_id: row.step_id ?? undefined,
    agent_trajectory_ref: row.agent_trajectory_ref ?? undefined,
    timestamp: row.timestamp,
  };
}
