import Database from 'better-sqlite3';
import type { Plan, PlanVersion } from '../domain/plan.js';
import type { Step } from '../domain/step.js';
import type { Summary } from '../domain/summary.js';
import type { PlanStatus } from '../domain/status.js';
import type { ApprovalInfo } from '../domain/workflow.js';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  SuggestedChanges,
} from '../domain/change-request.js';
import type { PlanStorage } from './interface.js';
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
        status, result_version, created_at, updated_at
      )
      VALUES (
        @change_request_id, @run_id, @plan_id, @reason, @suggested_changes_json,
        @status, @result_version, @created_at, @updated_at
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
      created_at: changeRequest.created_at,
      updated_at: changeRequest.updated_at,
    });
    return changeRequest;
  }

  getChangeRequest(changeRequestId: string): ChangeRequest | null {
    const stmt = this.db.prepare<string, ChangeRequestRow>(`
      SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
             status, result_version, created_at, updated_at
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

  listChangeRequestsByPlan(planId: string): ChangeRequest[] {
    const stmt = this.db.prepare<string, ChangeRequestRow>(`
      SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
             status, result_version, created_at, updated_at
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
             status, result_version, created_at, updated_at
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
    return changeRequest;
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
