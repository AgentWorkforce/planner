import Database from 'better-sqlite3';
import type { Plan, PlanVersion } from '../domain/plan.js';
import type { Step } from '../domain/step.js';
import type { Summary } from '../domain/summary.js';
import type { PlanStatus } from '../domain/status.js';
import type { ApprovalInfo } from '../domain/workflow.js';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  RevisionStatus,
  SuggestedChanges,
} from '../domain/change-request.js';
import type { Comment } from '../domain/comment.js';
import type {
  Improvement,
  ImprovementType,
  ImprovementStatus,
} from '../domain/improvement.js';
import type { PlanStorage, Session, SessionStatus } from './interface.js';
import { ALL_SCHEMA_STATEMENTS } from './schema.js';

/**
 * Row types for database queries
 */
interface PlanRow {
  plan_id: string;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  plan_id: string;
  version: number;
  status: string;
  summary_json: string;
  submitted_at: string | null;
  approval_info_json: string | null;
  change_request_id: string | null;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  plan_id: string;
  version: number;
  step_id: string;
  step_order: number;
  step_json: string;
}

interface ChangeRequestRow {
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

interface CommentRow {
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

interface SessionRow {
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

interface ImprovementRow {
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

/**
 * SQLite implementation of PlanStorage.
 */
export class SqliteStorage implements PlanStorage {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  /**
   * Initialize database schema.
   */
  private initialize(): void {
    for (const statement of ALL_SCHEMA_STATEMENTS) {
      this.db.exec(statement);
    }
  }

  // ============================================
  // Plan operations
  // ============================================

  createPlan(plan: Plan): Plan {
    const stmt = this.db.prepare(`
      INSERT INTO plans (plan_id, created_at, updated_at)
      VALUES (@plan_id, @created_at, @updated_at)
    `);
    stmt.run({
      plan_id: plan.plan_id,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    });
    return plan;
  }

  getPlan(planId: string): Plan | null {
    const stmt = this.db.prepare<string, PlanRow>(`
      SELECT plan_id, created_at, updated_at
      FROM plans
      WHERE plan_id = ?
    `);
    const row = stmt.get(planId);
    if (!row) return null;
    return this.rowToPlan(row);
  }

  updatePlan(planId: string): Plan | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE plans
      SET updated_at = ?
      WHERE plan_id = ?
    `);
    const result = stmt.run(now, planId);
    if (result.changes === 0) return null;
    return this.getPlan(planId);
  }

  deletePlan(planId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM plans
      WHERE plan_id = ?
    `);
    const result = stmt.run(planId);
    return result.changes > 0;
  }

  listPlans(status?: PlanStatus): Plan[] {
    if (status) {
      // Filter plans that have at least one version with the given status
      const stmt = this.db.prepare<string, PlanRow>(`
        SELECT DISTINCT p.plan_id, p.created_at, p.updated_at
        FROM plans p
        INNER JOIN versions v ON p.plan_id = v.plan_id
        WHERE v.status = ?
        ORDER BY p.updated_at DESC
      `);
      const rows = stmt.all(status);
      return rows.map((row) => this.rowToPlan(row));
    }

    const stmt = this.db.prepare<[], PlanRow>(`
      SELECT plan_id, created_at, updated_at
      FROM plans
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all();
    return rows.map((row) => this.rowToPlan(row));
  }

  // ============================================
  // Version operations
  // ============================================

  createVersion(version: PlanVersion): PlanVersion {
    const transaction = this.db.transaction(() => {
      // Insert version
      const versionStmt = this.db.prepare(`
        INSERT INTO versions (plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, created_at, updated_at)
        VALUES (@plan_id, @version, @status, @summary_json, @submitted_at, @approval_info_json, @change_request_id, @created_at, @updated_at)
      `);
      versionStmt.run({
        plan_id: version.plan_id,
        version: version.version,
        status: version.status,
        summary_json: JSON.stringify(version.summary),
        submitted_at: version.submitted_at ?? null,
        approval_info_json: version.approval_info
          ? JSON.stringify(version.approval_info)
          : null,
        change_request_id: version.change_request_id ?? null,
        created_at: version.created_at,
        updated_at: version.updated_at,
      });

      // Insert steps
      const stepStmt = this.db.prepare(`
        INSERT INTO steps (plan_id, version, step_id, step_order, step_json)
        VALUES (@plan_id, @version, @step_id, @step_order, @step_json)
      `);
      version.steps.forEach((step, index) => {
        stepStmt.run({
          plan_id: version.plan_id,
          version: version.version,
          step_id: step.step_id,
          step_order: index,
          step_json: JSON.stringify(step),
        });
      });

      // Update plan's updated_at
      const updatePlanStmt = this.db.prepare(`
        UPDATE plans SET updated_at = ? WHERE plan_id = ?
      `);
      updatePlanStmt.run(version.updated_at, version.plan_id);
    });

    transaction();
    return version;
  }

  getVersion(planId: string, version: number): PlanVersion | null {
    const versionStmt = this.db.prepare<[string, number], VersionRow>(`
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, created_at, updated_at
      FROM versions
      WHERE plan_id = ? AND version = ?
    `);
    const versionRow = versionStmt.get(planId, version);
    if (!versionRow) return null;

    const steps = this.getStepsForVersion(planId, version);
    return this.rowToVersion(versionRow, steps);
  }

  getLatestVersion(planId: string): PlanVersion | null {
    const versionStmt = this.db.prepare<string, VersionRow>(`
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, created_at, updated_at
      FROM versions
      WHERE plan_id = ?
      ORDER BY version DESC
      LIMIT 1
    `);
    const versionRow = versionStmt.get(planId);
    if (!versionRow) return null;

    const steps = this.getStepsForVersion(planId, versionRow.version);
    return this.rowToVersion(versionRow, steps);
  }

  listVersions(planId: string): PlanVersion[] {
    const versionStmt = this.db.prepare<string, VersionRow>(`
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, created_at, updated_at
      FROM versions
      WHERE plan_id = ?
      ORDER BY version ASC
    `);
    const versionRows = versionStmt.all(planId);

    return versionRows.map((row) => {
      const steps = this.getStepsForVersion(row.plan_id, row.version);
      return this.rowToVersion(row, steps);
    });
  }

  updateVersionStatus(
    planId: string,
    version: number,
    status: PlanStatus
  ): PlanVersion | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE versions
      SET status = ?, updated_at = ?
      WHERE plan_id = ? AND version = ?
    `);
    const result = stmt.run(status, now, planId, version);
    if (result.changes === 0) return null;

    // Also update plan's updated_at
    const updatePlanStmt = this.db.prepare(`
      UPDATE plans SET updated_at = ? WHERE plan_id = ?
    `);
    updatePlanStmt.run(now, planId);

    return this.getVersion(planId, version);
  }

  // ============================================
  // Workflow operations
  // ============================================

  submitVersion(planId: string, version: number): PlanVersion | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE versions
      SET submitted_at = ?, updated_at = ?
      WHERE plan_id = ? AND version = ?
    `);
    const result = stmt.run(now, now, planId, version);
    if (result.changes === 0) return null;

    // Also update plan's updated_at
    const updatePlanStmt = this.db.prepare(`
      UPDATE plans SET updated_at = ? WHERE plan_id = ?
    `);
    updatePlanStmt.run(now, planId);

    return this.getVersion(planId, version);
  }

  approveVersion(
    planId: string,
    version: number,
    approvalInfo: ApprovalInfo
  ): PlanVersion | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE versions
      SET status = 'approved', approval_info_json = ?, updated_at = ?
      WHERE plan_id = ? AND version = ?
    `);
    const result = stmt.run(
      JSON.stringify(approvalInfo),
      now,
      planId,
      version
    );
    if (result.changes === 0) return null;

    // Also update plan's updated_at
    const updatePlanStmt = this.db.prepare(`
      UPDATE plans SET updated_at = ? WHERE plan_id = ?
    `);
    updatePlanStmt.run(now, planId);

    return this.getVersion(planId, version);
  }

  // ============================================
  // Change request operations
  // ============================================

  createChangeRequest(changeRequest: ChangeRequest): ChangeRequest {
    const stmt = this.db.prepare(`
      INSERT INTO change_requests (
        change_request_id, run_id, plan_id, reason, suggested_changes_json,
        status, result_version, revision_session_id, revision_status, created_at, updated_at
      )
      VALUES (
        @change_request_id, @run_id, @plan_id, @reason, @suggested_changes_json,
        @status, @result_version, @revision_session_id, @revision_status, @created_at, @updated_at
      )
    `);
    stmt.run({
      change_request_id: changeRequest.change_request_id,
      run_id: changeRequest.run_id,
      plan_id: changeRequest.plan_id,
      reason: changeRequest.reason,
      suggested_changes_json: JSON.stringify(changeRequest.suggested_changes),
      status: changeRequest.status,
      result_version: changeRequest.result_version ?? null,
      revision_session_id: changeRequest.revision_session_id ?? null,
      revision_status: changeRequest.revision_status ?? null,
      created_at: changeRequest.created_at,
      updated_at: changeRequest.updated_at,
    });
    return changeRequest;
  }

  getChangeRequest(changeRequestId: string): ChangeRequest | null {
    const stmt = this.db.prepare<string, ChangeRequestRow>(`
      SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
             status, result_version, revision_session_id, revision_status, created_at, updated_at
      FROM change_requests
      WHERE change_request_id = ?
    `);
    const row = stmt.get(changeRequestId);
    if (!row) return null;
    return this.rowToChangeRequest(row);
  }

  updateChangeRequestStatus(
    changeRequestId: string,
    status: ChangeRequestStatus,
    resultVersion?: number
  ): ChangeRequest | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE change_requests
      SET status = ?, result_version = ?, updated_at = ?
      WHERE change_request_id = ?
    `);
    const result = stmt.run(status, resultVersion ?? null, now, changeRequestId);
    if (result.changes === 0) return null;
    return this.getChangeRequest(changeRequestId);
  }

  updateChangeRequestRevisionStatus(
    changeRequestId: string,
    revisionSessionId: string | null,
    revisionStatus: RevisionStatus
  ): ChangeRequest | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE change_requests
      SET revision_session_id = ?, revision_status = ?, updated_at = ?
      WHERE change_request_id = ?
    `);
    const result = stmt.run(revisionSessionId, revisionStatus, now, changeRequestId);
    if (result.changes === 0) return null;
    return this.getChangeRequest(changeRequestId);
  }

  listChangeRequestsByPlan(planId: string): ChangeRequest[] {
    const stmt = this.db.prepare<string, ChangeRequestRow>(`
      SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
             status, result_version, revision_session_id, revision_status, created_at, updated_at
      FROM change_requests
      WHERE plan_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(planId);
    return rows.map((row) => this.rowToChangeRequest(row));
  }

  listChangeRequestsByRun(runId: string): ChangeRequest[] {
    const stmt = this.db.prepare<string, ChangeRequestRow>(`
      SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
             status, result_version, revision_session_id, revision_status, created_at, updated_at
      FROM change_requests
      WHERE run_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(runId);
    return rows.map((row) => this.rowToChangeRequest(row));
  }

  getVersionByChangeRequest(changeRequestId: string): PlanVersion | null {
    const versionStmt = this.db.prepare<string, VersionRow>(`
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, created_at, updated_at
      FROM versions
      WHERE change_request_id = ?
    `);
    const versionRow = versionStmt.get(changeRequestId);
    if (!versionRow) return null;

    const steps = this.getStepsForVersion(versionRow.plan_id, versionRow.version);
    return this.rowToVersion(versionRow, steps);
  }

  // ============================================
  // Helper methods
  // ============================================

  private getStepsForVersion(planId: string, version: number): Step[] {
    const stepStmt = this.db.prepare<[string, number], StepRow>(`
      SELECT plan_id, version, step_id, step_order, step_json
      FROM steps
      WHERE plan_id = ? AND version = ?
      ORDER BY step_order ASC
    `);
    const stepRows = stepStmt.all(planId, version);
    return stepRows.map((row) => JSON.parse(row.step_json) as Step);
  }

  private rowToPlan(row: PlanRow): Plan {
    return {
      plan_id: row.plan_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToVersion(row: VersionRow, steps: Step[]): PlanVersion {
    const version: PlanVersion = {
      plan_id: row.plan_id,
      version: row.version,
      status: row.status as PlanStatus,
      summary: JSON.parse(row.summary_json) as Summary,
      steps,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    if (row.submitted_at) {
      version.submitted_at = row.submitted_at;
    }
    if (row.approval_info_json) {
      version.approval_info = JSON.parse(row.approval_info_json) as ApprovalInfo;
    }
    if (row.change_request_id) {
      version.change_request_id = row.change_request_id;
    }
    return version;
  }

  private rowToChangeRequest(row: ChangeRequestRow): ChangeRequest {
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

  private rowToComment(row: CommentRow): Comment {
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

  // ============================================
  // Comment operations
  // ============================================

  createComment(comment: Comment): Comment {
    const stmt = this.db.prepare(`
      INSERT INTO comments (
        comment_id, plan_id, version, step_id, parent_id, author, content,
        resolved, resolved_by, resolved_at, created_at, updated_at
      )
      VALUES (
        @comment_id, @plan_id, @version, @step_id, @parent_id, @author, @content,
        @resolved, @resolved_by, @resolved_at, @created_at, @updated_at
      )
    `);
    stmt.run({
      comment_id: comment.comment_id,
      plan_id: comment.plan_id,
      version: comment.version,
      step_id: comment.step_id,
      parent_id: comment.parent_id,
      author: comment.author,
      content: comment.content,
      resolved: comment.resolved ? 1 : 0,
      resolved_by: comment.resolved_by,
      resolved_at: comment.resolved_at,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
    });
    return comment;
  }

  getComment(commentId: string): Comment | null {
    const stmt = this.db.prepare<string, CommentRow>(`
      SELECT comment_id, plan_id, version, step_id, parent_id, author, content,
             resolved, resolved_by, resolved_at, created_at, updated_at
      FROM comments
      WHERE comment_id = ?
    `);
    const row = stmt.get(commentId);
    if (!row) return null;
    return this.rowToComment(row);
  }

  updateComment(commentId: string, content: string): Comment | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE comments
      SET content = ?, updated_at = ?
      WHERE comment_id = ?
    `);
    const result = stmt.run(content, now, commentId);
    if (result.changes === 0) return null;
    return this.getComment(commentId);
  }

  resolveComment(commentId: string, resolvedBy: string): Comment | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE comments
      SET resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ?
      WHERE comment_id = ?
    `);
    const result = stmt.run(resolvedBy, now, now, commentId);
    if (result.changes === 0) return null;
    return this.getComment(commentId);
  }

  unresolveComment(commentId: string): Comment | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE comments
      SET resolved = 0, resolved_by = NULL, resolved_at = NULL, updated_at = ?
      WHERE comment_id = ?
    `);
    const result = stmt.run(now, commentId);
    if (result.changes === 0) return null;
    return this.getComment(commentId);
  }

  deleteComment(commentId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM comments
      WHERE comment_id = ?
    `);
    const result = stmt.run(commentId);
    return result.changes > 0;
  }

  listCommentsByStep(planId: string, version: number, stepId: string): Comment[] {
    const stmt = this.db.prepare<[string, number, string], CommentRow>(`
      SELECT comment_id, plan_id, version, step_id, parent_id, author, content,
             resolved, resolved_by, resolved_at, created_at, updated_at
      FROM comments
      WHERE plan_id = ? AND version = ? AND step_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(planId, version, stepId);
    return rows.map((row) => this.rowToComment(row));
  }

  listCommentsByVersion(planId: string, version: number): Comment[] {
    const stmt = this.db.prepare<[string, number], CommentRow>(`
      SELECT comment_id, plan_id, version, step_id, parent_id, author, content,
             resolved, resolved_by, resolved_at, created_at, updated_at
      FROM comments
      WHERE plan_id = ? AND version = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(planId, version);
    return rows.map((row) => this.rowToComment(row));
  }

  countUnresolvedComments(planId: string, version: number): number {
    const stmt = this.db.prepare<[string, number], { count: number }>(`
      SELECT COUNT(*) as count
      FROM comments
      WHERE plan_id = ? AND version = ? AND resolved = 0
    `);
    const result = stmt.get(planId, version);
    return result?.count ?? 0;
  }

  countUnresolvedCommentsByStep(
    planId: string,
    version: number,
    stepId: string
  ): number {
    const stmt = this.db.prepare<[string, number, string], { count: number }>(`
      SELECT COUNT(*) as count
      FROM comments
      WHERE plan_id = ? AND version = ? AND step_id = ? AND resolved = 0
    `);
    const result = stmt.get(planId, version, stepId);
    return result?.count ?? 0;
  }

  // ============================================
  // Session operations
  // ============================================

  createSession(session: Session): Session {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at)
      VALUES (@session_id, @token, @plan_id, @agent_id, @status, @started_at, @ended_at, @expires_at, @created_at)
    `);
    stmt.run({
      session_id: session.session_id,
      token: session.token,
      plan_id: session.plan_id,
      agent_id: session.agent_id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      expires_at: session.expires_at,
      created_at: session.created_at,
    });
    return session;
  }

  getSessionByToken(token: string): Session | null {
    const stmt = this.db.prepare<string, SessionRow>(`
      SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
      FROM sessions
      WHERE token = ?
    `);
    const row = stmt.get(token);
    if (!row) return null;
    return this.rowToSession(row);
  }

  getSessionByPlanId(planId: string): Session | null {
    const stmt = this.db.prepare<string, SessionRow>(`
      SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
      FROM sessions
      WHERE plan_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(planId);
    if (!row) return null;
    return this.rowToSession(row);
  }

  getActiveSessions(): Session[] {
    const stmt = this.db.prepare<[], SessionRow>(`
      SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
      FROM sessions
      WHERE status = 'active'
      ORDER BY created_at ASC
    `);
    const rows = stmt.all();
    return rows.map((row) => this.rowToSession(row));
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): Session | null {
    const endedAt = status === 'active' ? null : new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET status = @status, ended_at = @ended_at
      WHERE session_id = @session_id
    `);
    const result = stmt.run({
      session_id: sessionId,
      status,
      ended_at: endedAt,
    });
    if (result.changes === 0) return null;
    return this.getSessionById(sessionId);
  }

  private getSessionById(sessionId: string): Session | null {
    const stmt = this.db.prepare<string, SessionRow>(`
      SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
      FROM sessions
      WHERE session_id = ?
    `);
    const row = stmt.get(sessionId);
    if (!row) return null;
    return this.rowToSession(row);
  }

  deleteSession(sessionId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM sessions
      WHERE session_id = ?
    `);
    const result = stmt.run(sessionId);
    return result.changes > 0;
  }

  deleteSessionsByPlan(planId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM sessions
      WHERE plan_id = ?
    `);
    const result = stmt.run(planId);
    return result.changes;
  }

  private rowToSession(row: SessionRow): Session {
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

  // ============================================
  // Improvement operations
  // ============================================

  createImprovement(improvement: Improvement): Improvement {
    const stmt = this.db.prepare(`
      INSERT INTO improvements (
        improvement_id, plan_id, version, step_id, type, description,
        suggested_change_json, status, created_at, updated_at
      )
      VALUES (
        @improvement_id, @plan_id, @version, @step_id, @type, @description,
        @suggested_change_json, @status, @created_at, @updated_at
      )
    `);
    stmt.run({
      improvement_id: improvement.improvement_id,
      plan_id: improvement.plan_id,
      version: improvement.version,
      step_id: improvement.step_id ?? null,
      type: improvement.type,
      description: improvement.description,
      suggested_change_json: improvement.suggested_change
        ? JSON.stringify(improvement.suggested_change)
        : null,
      status: improvement.status,
      created_at: improvement.created_at,
      updated_at: improvement.updated_at,
    });
    return improvement;
  }

  getImprovement(improvementId: string): Improvement | null {
    const stmt = this.db.prepare<string, ImprovementRow>(`
      SELECT improvement_id, plan_id, version, step_id, type, description,
             suggested_change_json, status, created_at, updated_at
      FROM improvements
      WHERE improvement_id = ?
    `);
    const row = stmt.get(improvementId);
    if (!row) return null;
    return this.rowToImprovement(row);
  }

  updateImprovementStatus(
    improvementId: string,
    status: ImprovementStatus
  ): Improvement | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE improvements
      SET status = ?, updated_at = ?
      WHERE improvement_id = ?
    `);
    const result = stmt.run(status, now, improvementId);
    if (result.changes === 0) return null;
    return this.getImprovement(improvementId);
  }

  listImprovementsByVersion(planId: string, version: number): Improvement[] {
    const stmt = this.db.prepare<[string, number], ImprovementRow>(`
      SELECT improvement_id, plan_id, version, step_id, type, description,
             suggested_change_json, status, created_at, updated_at
      FROM improvements
      WHERE plan_id = ? AND version = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(planId, version);
    return rows.map((row) => this.rowToImprovement(row));
  }

  listImprovementsByStep(
    planId: string,
    version: number,
    stepId: string
  ): Improvement[] {
    const stmt = this.db.prepare<[string, number, string], ImprovementRow>(`
      SELECT improvement_id, plan_id, version, step_id, type, description,
             suggested_change_json, status, created_at, updated_at
      FROM improvements
      WHERE plan_id = ? AND version = ? AND step_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(planId, version, stepId);
    return rows.map((row) => this.rowToImprovement(row));
  }

  listPendingImprovements(planId: string, version: number): Improvement[] {
    const stmt = this.db.prepare<[string, number], ImprovementRow>(`
      SELECT improvement_id, plan_id, version, step_id, type, description,
             suggested_change_json, status, created_at, updated_at
      FROM improvements
      WHERE plan_id = ? AND version = ? AND status = 'pending'
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(planId, version);
    return rows.map((row) => this.rowToImprovement(row));
  }

  deleteImprovement(improvementId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM improvements
      WHERE improvement_id = ?
    `);
    const result = stmt.run(improvementId);
    return result.changes > 0;
  }

  private rowToImprovement(row: ImprovementRow): Improvement {
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

  // ============================================
  // Transaction support
  // ============================================

  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  // ============================================
  // Lifecycle
  // ============================================

  close(): void {
    this.db.close();
  }
}
