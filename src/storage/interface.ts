import type { Plan, PlanVersion } from '../domain/plan.js';
import type { PlanStatus } from '../domain/status.js';
import type { ApprovalInfo } from '../domain/workflow.js';
import type { ChangeRequest, ChangeRequestStatus, RevisionStatus } from '../domain/change-request.js';
import type { Comment } from '../domain/comment.js';
import type { Improvement, ImprovementStatus } from '../domain/improvement.js';

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
 * PlanStorage interface defines all storage operations for plans and versions.
 */
export interface PlanStorage {
  // Plan operations
  createPlan(plan: Plan): Plan;
  getPlan(planId: string): Plan | null;
  updatePlan(planId: string): Plan | null;
  deletePlan(planId: string): boolean;
  listPlans(status?: PlanStatus): Plan[];
  listPlansWithAttention(status?: PlanStatus): PlanWithAttentionData[];

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

  // Transaction support
  transaction<T>(fn: () => T): T;

  // Lifecycle
  close(): void;
}
