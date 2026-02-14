import type { Plan, PlanVersion, Understanding } from '../domain/plan.js';
import type { Context } from '../domain/context.js';
import type { PlanStatus } from '../domain/status.js';
import type { ApprovalInfo } from '../domain/workflow.js';
import type { ChangeRequest, ChangeRequestStatus, RevisionStatus } from '../domain/change-request.js';
import type { Comment } from '../domain/comment.js';
import type { Improvement, ImprovementStatus } from '../domain/improvement.js';
import type { Organization, Initiative } from '../domain/organization.js';
import type { Question, QuestionStatus, QuestionFilter } from '../domain/question.js';
import type { DecisionEvent, TrajectoryEventFilter } from '../domain/trajectory.js';

/**
 * Project represents a unified entity linking ideation sessions, plans, and forge runs.
 */
export interface Project {
  id: string;
  name: string;
  owner_id: string | null;
  initiative_id: string | null;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  config: Record<string, unknown> | null;
  current_focus: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Filter options for project list queries.
 */
export interface ProjectFilter {
  owner_id?: string;
  initiative_id?: string;
  session_id?: string;
}

/**
 * Plan data with pre-joined attention signal inputs.
 * Used by listPlansWithAttention to avoid N+1 queries.
 */
export interface PlanWithAttentionData {
  plan: Plan;
  latestVersion: PlanVersion;
  pendingChangeRequestCount: number;
  unresolvedCommentCount: number;
}

/**
 * Session status for lifecycle management.
 */
export type SessionStatus = 'active' | 'completed' | 'timeout' | 'terminated' | 'error';

/**
 * Session represents an authenticated agent session for MCP connections
 * and planning session lifecycle management.
 */
export interface Session {
  session_id: string;
  token: string;
  plan_id: string;
  agent_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Filter options for plan list queries
 */
export interface PlanFilter {
  org_id?: string;
  initiative_id?: string;
  owner_user_id?: string;
  status?: PlanStatus;
}

/**
 * PlanStorage interface defines all storage operations for plans and versions.
 */
export interface PlanStorage {
  // Organization operations
  createOrganization(org: Organization): Organization;
  getOrganization(orgId: string): Organization | null;
  listOrganizations(): Organization[];

  // Initiative operations
  createInitiative(initiative: Initiative): Initiative;
  getInitiative(initiativeId: string): Initiative | null;
  updateInitiative(initiativeId: string, updates: Partial<Initiative>): Initiative | null;
  deleteInitiative(initiativeId: string): boolean;
  listInitiatives(orgId: string): Initiative[];

  // Plan operations
  createPlan(plan: Plan): Plan;
  getPlan(planId: string): Plan | null;
  updatePlan(planId: string, updates?: { initiative_id?: string | null }): Plan | null;
  deletePlan(planId: string): boolean;
  listPlans(filter?: PlanFilter): Plan[];
  listPlansWithAttention(filter?: PlanFilter): PlanWithAttentionData[];

  // Version operations
  createVersion(version: PlanVersion): PlanVersion;
  getVersion(planId: string, version: number): PlanVersion | null;
  getLatestVersion(planId: string): PlanVersion | null;
  listVersions(planId: string): PlanVersion[];
  updateVersionStatus(
    planId: string,
    version: number,
    status: PlanStatus
  ): PlanVersion | null;
  updateVersionContext(
    planId: string,
    version: number,
    context: Context
  ): PlanVersion | null;
  updateVersionUnderstanding(
    planId: string,
    version: number,
    understanding: Understanding
  ): PlanVersion | null;

  // Sub-plan hierarchy queries
  getSubPlanIds(planId: string): string[];
  getDependentPlanIds(planId: string): string[];

  // Workflow operations
  submitVersion(planId: string, version: number): PlanVersion | null;
  approveVersion(
    planId: string,
    version: number,
    approvalInfo: ApprovalInfo
  ): PlanVersion | null;

  // Change request operations
  createChangeRequest(changeRequest: ChangeRequest): ChangeRequest;
  getChangeRequest(changeRequestId: string): ChangeRequest | null;
  updateChangeRequestStatus(
    changeRequestId: string,
    status: ChangeRequestStatus,
    resultVersion?: number
  ): ChangeRequest | null;
  updateChangeRequestRevisionStatus(
    changeRequestId: string,
    revisionSessionId: string | null,
    revisionStatus: RevisionStatus
  ): ChangeRequest | null;
  listChangeRequestsByPlan(planId: string): ChangeRequest[];
  listChangeRequestsByRun(runId: string): ChangeRequest[];
  getVersionByChangeRequest(changeRequestId: string): PlanVersion | null;

  // Comment operations
  createComment(comment: Comment): Comment;
  getComment(commentId: string): Comment | null;
  updateComment(commentId: string, content: string): Comment | null;
  resolveComment(commentId: string, resolvedBy: string): Comment | null;
  unresolveComment(commentId: string): Comment | null;
  deleteComment(commentId: string): boolean;
  listCommentsByStep(planId: string, version: number, stepId: string): Comment[];
  listCommentsByVersion(planId: string, version: number): Comment[];
  countUnresolvedComments(planId: string, version: number): number;
  countUnresolvedCommentsByStep(
    planId: string,
    version: number,
    stepId: string
  ): number;

  // Session operations
  createSession(session: Session): Session;
  getSessionByToken(token: string): Session | null;
  getSessionByPlanId(planId: string): Session | null;
  getActiveSessions(): Session[];
  updateSessionStatus(sessionId: string, status: SessionStatus): Session | null;
  deleteSession(sessionId: string): boolean;
  deleteSessionsByPlan(planId: string): number;

  // Improvement operations
  createImprovement(improvement: Improvement): Improvement;
  getImprovement(improvementId: string): Improvement | null;
  updateImprovementStatus(
    improvementId: string,
    status: ImprovementStatus
  ): Improvement | null;
  listImprovementsByVersion(planId: string, version: number): Improvement[];
  listImprovementsByStep(
    planId: string,
    version: number,
    stepId: string
  ): Improvement[];
  listPendingImprovements(planId: string, version: number): Improvement[];
  deleteImprovement(improvementId: string): boolean;

  // Question operations
  createQuestion(question: Question): Question;
  getQuestion(questionId: string): Question | null;
  updateQuestion(questionId: string, updates: Partial<Question>): Question | null;
  answerQuestion(questionId: string, answer: string): Question | null;
  dismissQuestion(questionId: string): Question | null;
  subscribeToQuestion(questionId: string, agentId: string): Question | null;
  mergeQuestions(targetId: string, duplicateId: string): Question | null;
  listQuestionsByPlan(planId: string, status?: QuestionStatus): Question[];
  listPendingQuestionsByPriority(planId: string): Question[];
  findDuplicateQuestions(planId: string, agentId: string, textPrefix: string): Question[];
  deleteQuestion(questionId: string): boolean;

  // Trajectory operations
  createTrajectoryEvent(event: DecisionEvent): DecisionEvent;
  getTrajectoryEvent(eventId: string): DecisionEvent | null;
  listTrajectoryEvents(planId: string, filter?: TrajectoryEventFilter): DecisionEvent[];
  findSimilarQuestions(planId: string, text: string, threshold?: number): DecisionEvent[];
  deleteTrajectoryEvent(eventId: string): boolean;

  // Project operations
  createProject(project: Project): Project;
  getProject(id: string): Project | null;
  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>): Project | null;
  updateProjectFocus(id: string, focus: Record<string, unknown>): Project | null;
  listProjects(filter?: ProjectFilter): Project[];
  deleteProject(id: string): boolean;

  // Transaction support
  transaction<T>(fn: () => T): T;

  // Lifecycle
  close(): void;
}
