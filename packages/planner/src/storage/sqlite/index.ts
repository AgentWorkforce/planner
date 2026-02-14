import { BaseSqliteStorage } from '@plannr/storage-base';
import type { Plan, PlanVersion, Understanding } from '../../domain/plan.js';
import type { Context } from '../../domain/context.js';
import type { PlanStatus } from '../../domain/status.js';
import type { ApprovalInfo } from '../../domain/workflow.js';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  RevisionStatus,
} from '../../domain/change-request.js';
import type { Comment } from '../../domain/comment.js';
import type {
  Improvement,
  ImprovementStatus,
} from '../../domain/improvement.js';
import type { Organization, Initiative } from '../../domain/organization.js';
import type {
  Question,
  QuestionStatus,
} from '../../domain/question.js';
import type { DecisionEvent, TrajectoryEventFilter } from '../../domain/trajectory.js';
import type { PlanStorage, PlanWithAttentionData, Session, SessionStatus, PlanFilter } from '../interface.js';
import { ALL_SCHEMA_STATEMENTS } from '../schema.js';
import { runMigrations } from '../migration.js';

// Import all module functions
import * as Organizations from './organizations.js';
import * as Plans from './plans.js';
import * as Versions from './versions.js';
import * as Workflow from './workflow.js';
import * as ChangeRequests from './change-requests.js';
import * as Comments from './comments.js';
import * as Sessions from './sessions.js';
import * as Improvements from './improvements.js';
import * as Questions from './questions.js';
import * as Trajectory from './trajectory.js';
import * as Projects from './projects.js';

/**
 * SQLite implementation of PlanStorage.
 */
export class SqliteStorage extends BaseSqliteStorage implements PlanStorage {
  constructor(dbPath: string = ':memory:') {
    super(dbPath);
  }

  /**
   * Initialize database schema.
   *
   * Migration order is critical:
   * 1. Check if plans table exists (existing database)
   * 2. If exists, run migrations FIRST to add missing columns
   * 3. Then run all schema statements (CREATE TABLE IF NOT EXISTS is idempotent)
   *
   * This ensures indexes on new columns (org_id, initiative_id) are created
   * AFTER migrations add those columns to existing plans tables.
   */
  protected initializeSchema(): void {
    // Check if this is an existing database with plans table
    const plansTableExists = this.db
      .prepare<[], { name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='plans'`
      )
      .get();

    if (plansTableExists) {
      // Existing database - run migrations first to add new columns
      runMigrations(this.db);
    }

    // Now run all schema statements (safe with IF NOT EXISTS)
    for (const statement of ALL_SCHEMA_STATEMENTS) {
      this.db.exec(statement);
    }

    if (!plansTableExists) {
      // New database - run migrations after schema to create default org
      runMigrations(this.db);
    }
  }

  // ============================================
  // Organization operations
  // ============================================

  createOrganization(org: Organization): Organization {
    return Organizations.createOrganization(this.db, org);
  }

  getOrganization(orgId: string): Organization | null {
    return Organizations.getOrganization(this.db, orgId);
  }

  listOrganizations(): Organization[] {
    return Organizations.listOrganizations(this.db);
  }

  // ============================================
  // Initiative operations
  // ============================================

  createInitiative(initiative: Initiative): Initiative {
    return Organizations.createInitiative(this.db, initiative);
  }

  getInitiative(initiativeId: string): Initiative | null {
    return Organizations.getInitiative(this.db, initiativeId);
  }

  updateInitiative(initiativeId: string, updates: Partial<Initiative>): Initiative | null {
    return Organizations.updateInitiative(this.db, initiativeId, updates);
  }

  deleteInitiative(initiativeId: string): boolean {
    return Organizations.deleteInitiative(this.db, initiativeId);
  }

  listInitiatives(orgId: string): Initiative[] {
    return Organizations.listInitiatives(this.db, orgId);
  }

  // ============================================
  // Plan operations
  // ============================================

  createPlan(plan: Plan): Plan {
    return Plans.createPlan(this.db, plan);
  }

  getPlan(planId: string): Plan | null {
    return Plans.getPlan(this.db, planId);
  }

  updatePlan(planId: string, updates?: { initiative_id?: string | null }): Plan | null {
    return Plans.updatePlan(this.db, planId, updates);
  }

  deletePlan(planId: string): boolean {
    return Plans.deletePlan(this.db, planId);
  }

  listPlans(filter?: PlanFilter): Plan[] {
    return Plans.listPlans(this.db, filter);
  }

  listPlansWithAttention(filter?: PlanFilter): PlanWithAttentionData[] {
    return Plans.listPlansWithAttention(this.db, filter);
  }

  // ============================================
  // Version operations
  // ============================================

  createVersion(version: PlanVersion): PlanVersion {
    return Versions.createVersion(this.db, version);
  }

  getVersion(planId: string, version: number): PlanVersion | null {
    return Versions.getVersion(this.db, planId, version);
  }

  getLatestVersion(planId: string): PlanVersion | null {
    return Versions.getLatestVersion(this.db, planId);
  }

  listVersions(planId: string): PlanVersion[] {
    return Versions.listVersions(this.db, planId);
  }

  updateVersionStatus(
    planId: string,
    version: number,
    status: PlanStatus
  ): PlanVersion | null {
    return Versions.updateVersionStatus(this.db, planId, version, status);
  }

  updateVersionContext(
    planId: string,
    version: number,
    context: Context
  ): PlanVersion | null {
    return Versions.updateVersionContext(this.db, planId, version, context);
  }

  updateVersionUnderstanding(
    planId: string,
    version: number,
    understanding: Understanding
  ): PlanVersion | null {
    return Versions.updateVersionUnderstanding(this.db, planId, version, understanding);
  }

  getSubPlanIds(planId: string): string[] {
    return Versions.getSubPlanIds(this.db, planId);
  }

  getDependentPlanIds(planId: string): string[] {
    return Versions.getDependentPlanIds(this.db, planId);
  }

  // ============================================
  // Workflow operations
  // ============================================

  submitVersion(planId: string, version: number): PlanVersion | null {
    return Workflow.submitVersion(this.db, planId, version);
  }

  approveVersion(
    planId: string,
    version: number,
    approvalInfo: ApprovalInfo
  ): PlanVersion | null {
    return Workflow.approveVersion(this.db, planId, version, approvalInfo);
  }

  // ============================================
  // Change request operations
  // ============================================

  createChangeRequest(changeRequest: ChangeRequest): ChangeRequest {
    return ChangeRequests.createChangeRequest(this.db, changeRequest);
  }

  getChangeRequest(changeRequestId: string): ChangeRequest | null {
    return ChangeRequests.getChangeRequest(this.db, changeRequestId);
  }

  updateChangeRequestStatus(
    changeRequestId: string,
    status: ChangeRequestStatus,
    resultVersion?: number
  ): ChangeRequest | null {
    return ChangeRequests.updateChangeRequestStatus(this.db, changeRequestId, status, resultVersion);
  }

  updateChangeRequestRevisionStatus(
    changeRequestId: string,
    revisionSessionId: string | null,
    revisionStatus: RevisionStatus
  ): ChangeRequest | null {
    return ChangeRequests.updateChangeRequestRevisionStatus(
      this.db,
      changeRequestId,
      revisionSessionId,
      revisionStatus
    );
  }

  listChangeRequestsByPlan(planId: string): ChangeRequest[] {
    return ChangeRequests.listChangeRequestsByPlan(this.db, planId);
  }

  listChangeRequestsByRun(runId: string): ChangeRequest[] {
    return ChangeRequests.listChangeRequestsByRun(this.db, runId);
  }

  getVersionByChangeRequest(changeRequestId: string): PlanVersion | null {
    return ChangeRequests.getVersionByChangeRequest(this.db, changeRequestId);
  }

  // ============================================
  // Comment operations
  // ============================================

  createComment(comment: Comment): Comment {
    return Comments.createComment(this.db, comment);
  }

  getComment(commentId: string): Comment | null {
    return Comments.getComment(this.db, commentId);
  }

  updateComment(commentId: string, content: string): Comment | null {
    return Comments.updateComment(this.db, commentId, content);
  }

  resolveComment(commentId: string, resolvedBy: string): Comment | null {
    return Comments.resolveComment(this.db, commentId, resolvedBy);
  }

  unresolveComment(commentId: string): Comment | null {
    return Comments.unresolveComment(this.db, commentId);
  }

  deleteComment(commentId: string): boolean {
    return Comments.deleteComment(this.db, commentId);
  }

  listCommentsByStep(planId: string, version: number, stepId: string): Comment[] {
    return Comments.listCommentsByStep(this.db, planId, version, stepId);
  }

  listCommentsByVersion(planId: string, version: number): Comment[] {
    return Comments.listCommentsByVersion(this.db, planId, version);
  }

  countUnresolvedComments(planId: string, version: number): number {
    return Comments.countUnresolvedComments(this.db, planId, version);
  }

  countUnresolvedCommentsByStep(
    planId: string,
    version: number,
    stepId: string
  ): number {
    return Comments.countUnresolvedCommentsByStep(this.db, planId, version, stepId);
  }

  // ============================================
  // Session operations
  // ============================================

  createSession(session: Session): Session {
    return Sessions.createSession(this.db, session);
  }

  getSessionByToken(token: string): Session | null {
    return Sessions.getSessionByToken(this.db, token);
  }

  getSessionByPlanId(planId: string): Session | null {
    return Sessions.getSessionByPlanId(this.db, planId);
  }

  getActiveSessions(): Session[] {
    return Sessions.getActiveSessions(this.db);
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): Session | null {
    return Sessions.updateSessionStatus(this.db, sessionId, status);
  }

  deleteSession(sessionId: string): boolean {
    return Sessions.deleteSession(this.db, sessionId);
  }

  deleteSessionsByPlan(planId: string): number {
    return Sessions.deleteSessionsByPlan(this.db, planId);
  }

  // ============================================
  // Improvement operations
  // ============================================

  createImprovement(improvement: Improvement): Improvement {
    return Improvements.createImprovement(this.db, improvement);
  }

  getImprovement(improvementId: string): Improvement | null {
    return Improvements.getImprovement(this.db, improvementId);
  }

  updateImprovementStatus(
    improvementId: string,
    status: ImprovementStatus
  ): Improvement | null {
    return Improvements.updateImprovementStatus(this.db, improvementId, status);
  }

  listImprovementsByVersion(planId: string, version: number): Improvement[] {
    return Improvements.listImprovementsByVersion(this.db, planId, version);
  }

  listImprovementsByStep(
    planId: string,
    version: number,
    stepId: string
  ): Improvement[] {
    return Improvements.listImprovementsByStep(this.db, planId, version, stepId);
  }

  listPendingImprovements(planId: string, version: number): Improvement[] {
    return Improvements.listPendingImprovements(this.db, planId, version);
  }

  deleteImprovement(improvementId: string): boolean {
    return Improvements.deleteImprovement(this.db, improvementId);
  }

  // ============================================
  // Question operations
  // ============================================

  createQuestion(question: Question): Question {
    return Questions.createQuestion(this.db, question);
  }

  getQuestion(questionId: string): Question | null {
    return Questions.getQuestion(this.db, questionId);
  }

  updateQuestion(questionId: string, updates: Partial<Question>): Question | null {
    return Questions.updateQuestion(this.db, questionId, updates);
  }

  answerQuestion(questionId: string, answer: string): Question | null {
    return Questions.answerQuestion(this.db, questionId, answer);
  }

  dismissQuestion(questionId: string): Question | null {
    return Questions.dismissQuestion(this.db, questionId);
  }

  subscribeToQuestion(questionId: string, agentId: string): Question | null {
    return Questions.subscribeToQuestion(this.db, questionId, agentId);
  }

  mergeQuestions(targetId: string, duplicateId: string): Question | null {
    return Questions.mergeQuestions(this.db, targetId, duplicateId);
  }

  listQuestionsByPlan(planId: string, status?: QuestionStatus): Question[] {
    return Questions.listQuestionsByPlan(this.db, planId, status);
  }

  listPendingQuestionsByPriority(planId: string): Question[] {
    return Questions.listPendingQuestionsByPriority(this.db, planId);
  }

  findDuplicateQuestions(planId: string, agentId: string, textPrefix: string): Question[] {
    return Questions.findDuplicateQuestions(this.db, planId, agentId, textPrefix);
  }

  deleteQuestion(questionId: string): boolean {
    return Questions.deleteQuestion(this.db, questionId);
  }

  // ============================================
  // Trajectory operations
  // ============================================

  createTrajectoryEvent(event: DecisionEvent): DecisionEvent {
    return Trajectory.createTrajectoryEvent(this.db, event);
  }

  getTrajectoryEvent(eventId: string): DecisionEvent | null {
    return Trajectory.getTrajectoryEvent(this.db, eventId);
  }

  listTrajectoryEvents(planId: string, filter?: TrajectoryEventFilter): DecisionEvent[] {
    return Trajectory.listTrajectoryEvents(this.db, planId, filter);
  }

  findSimilarQuestions(planId: string, text: string, threshold?: number): DecisionEvent[] {
    return Trajectory.findSimilarQuestions(this.db, planId, text, threshold);
  }

  deleteTrajectoryEvent(eventId: string): boolean {
    return Trajectory.deleteTrajectoryEvent(this.db, eventId);
  }

  // ============================================
  // Project operations
  // ============================================

  createProject(project: import('../interface.js').Project): import('../interface.js').Project {
    return Projects.createProject(this.db, project);
  }

  getProject(id: string): import('../interface.js').Project | null {
    return Projects.getProject(this.db, id);
  }

  updateProject(id: string, updates: Partial<Omit<import('../interface.js').Project, 'id' | 'created_at' | 'updated_at'>>): import('../interface.js').Project | null {
    return Projects.updateProject(this.db, id, updates);
  }

  updateProjectFocus(id: string, focus: Record<string, unknown>): import('../interface.js').Project | null {
    return Projects.updateProjectFocus(this.db, id, focus);
  }

  listProjects(filter?: import('../interface.js').ProjectFilter): import('../interface.js').Project[] {
    return Projects.listProjects(this.db, filter);
  }

  deleteProject(id: string): boolean {
    return Projects.deleteProject(this.db, id);
  }

  public transaction<T>(fn: () => T): T {
    return super.transaction(fn);
  }
}
