import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
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
import type { Organization, Initiative } from '../domain/organization.js';
import type {
  Question,
  QuestionBlockingLevel,
  QuestionStatus,
} from '../domain/question.js';
import { calculatePriorityScore } from '../domain/question.js';
import type { DecisionEvent, TrajectoryEventFilter } from '../domain/trajectory.js';
import type { PlanStorage, PlanWithAttentionData, Session, SessionStatus, PlanFilter } from './interface.js';
import { ALL_SCHEMA_STATEMENTS } from './schema.js';
import { runMigrations } from './migration.js';
import { seedIfEmpty } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Row types for database queries
 */
interface OrganizationRow {
  org_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

interface InitiativeRow {
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

interface PlanRow {
  plan_id: string;
  org_id: string;
  initiative_id: string | null;
  owner_user_id: string | null;
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
  metadata_json: string | null;
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

interface QuestionRow {
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

interface TrajectoryEventRow {
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

interface PlanWithAttentionRow {
  plan_id: string;
  org_id: string;
  initiative_id: string | null;
  owner_user_id: string | null;
  plan_created_at: string;
  plan_updated_at: string;
  version: number;
  status: string;
  summary_json: string;
  submitted_at: string | null;
  approval_info_json: string | null;
  change_request_id: string | null;
  metadata_json: string | null;
  version_created_at: string;
  version_updated_at: string;
  pending_change_request_count: number;
  unresolved_comment_count: number;
}

/** Options for SqliteStorage constructor */
export interface SqliteStorageOptions {
  /** Skip seeding sample data (useful for tests) */
  skipSeed?: boolean;
}

/**
 * SQLite implementation of PlanStorage.
 */
export class SqliteStorage implements PlanStorage {
  private db: Database.Database;
  private options: SqliteStorageOptions;

  constructor(dbPath: string = ':memory:', options: SqliteStorageOptions = {}) {
    this.db = new Database(dbPath);
    this.options = options;
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
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
  private initialize(): void {
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

      // Seed with sample data on first run (unless skipSeed option is set)
      if (!this.options.skipSeed) {
        this.seedOnFirstRun();
      }
    }
  }

  /**
   * Seed database with sample plans on first run.
   * Only runs if no plans exist.
   */
  private seedOnFirstRun(): void {
    try {
      // Project root is two levels up from src/storage/
      const projectRoot = path.resolve(__dirname, '../..');
      seedIfEmpty(this.db, projectRoot);
    } catch {
      // Seed files may not exist in all environments (e.g., tests)
    }
  }

  // ============================================
  // Organization operations
  // ============================================

  createOrganization(org: Organization): Organization {
    const stmt = this.db.prepare(`
      INSERT INTO organizations (org_id, name, slug, created_at, updated_at)
      VALUES (@org_id, @name, @slug, @created_at, @updated_at)
    `);
    stmt.run({
      org_id: org.org_id,
      name: org.name,
      slug: org.slug,
      created_at: org.created_at,
      updated_at: org.updated_at,
    });
    return org;
  }

  getOrganization(orgId: string): Organization | null {
    const stmt = this.db.prepare<string, OrganizationRow>(`
      SELECT org_id, name, slug, created_at, updated_at
      FROM organizations
      WHERE org_id = ?
    `);
    const row = stmt.get(orgId);
    if (!row) return null;
    return this.rowToOrganization(row);
  }

  listOrganizations(): Organization[] {
    const stmt = this.db.prepare<[], OrganizationRow>(`
      SELECT org_id, name, slug, created_at, updated_at
      FROM organizations
      ORDER BY name ASC
    `);
    const rows = stmt.all();
    return rows.map((row) => this.rowToOrganization(row));
  }

  // ============================================
  // Initiative operations
  // ============================================

  createInitiative(initiative: Initiative): Initiative {
    const stmt = this.db.prepare(`
      INSERT INTO initiatives (
        initiative_id, org_id, name, description, status,
        icon, color, display_order, created_at, updated_at
      )
      VALUES (
        @initiative_id, @org_id, @name, @description, @status,
        @icon, @color, @display_order, @created_at, @updated_at
      )
    `);
    stmt.run({
      initiative_id: initiative.initiative_id,
      org_id: initiative.org_id,
      name: initiative.name,
      description: initiative.description ?? null,
      status: initiative.status,
      icon: initiative.icon ?? null,
      color: initiative.color ?? null,
      display_order: initiative.display_order,
      created_at: initiative.created_at,
      updated_at: initiative.updated_at,
    });
    return initiative;
  }

  getInitiative(initiativeId: string): Initiative | null {
    const stmt = this.db.prepare<string, InitiativeRow>(`
      SELECT initiative_id, org_id, name, description, status,
             icon, color, display_order, created_at, updated_at
      FROM initiatives
      WHERE initiative_id = ?
    `);
    const row = stmt.get(initiativeId);
    if (!row) return null;
    return this.rowToInitiative(row);
  }

  updateInitiative(initiativeId: string, updates: Partial<Initiative>): Initiative | null {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: Record<string, unknown> = { initiative_id: initiativeId, updated_at: now };

    if (updates.name !== undefined) {
      fields.push('name = @name');
      values.name = updates.name;
    }
    if (updates.description !== undefined) {
      fields.push('description = @description');
      values.description = updates.description ?? null;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.icon !== undefined) {
      fields.push('icon = @icon');
      values.icon = updates.icon ?? null;
    }
    if (updates.color !== undefined) {
      fields.push('color = @color');
      values.color = updates.color ?? null;
    }
    if (updates.display_order !== undefined) {
      fields.push('display_order = @display_order');
      values.display_order = updates.display_order;
    }

    if (fields.length === 0) {
      return this.getInitiative(initiativeId);
    }

    fields.push('updated_at = @updated_at');

    const stmt = this.db.prepare(`
      UPDATE initiatives
      SET ${fields.join(', ')}
      WHERE initiative_id = @initiative_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getInitiative(initiativeId);
  }

  deleteInitiative(initiativeId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM initiatives
      WHERE initiative_id = ?
    `);
    const result = stmt.run(initiativeId);
    return result.changes > 0;
  }

  listInitiatives(orgId: string): Initiative[] {
    const stmt = this.db.prepare<string, InitiativeRow>(`
      SELECT initiative_id, org_id, name, description, status,
             icon, color, display_order, created_at, updated_at
      FROM initiatives
      WHERE org_id = ?
      ORDER BY display_order ASC, name ASC
    `);
    const rows = stmt.all(orgId);
    return rows.map((row) => this.rowToInitiative(row));
  }

  // ============================================
  // Plan operations
  // ============================================

  createPlan(plan: Plan): Plan {
    const stmt = this.db.prepare(`
      INSERT INTO plans (plan_id, org_id, initiative_id, owner_user_id, created_at, updated_at)
      VALUES (@plan_id, @org_id, @initiative_id, @owner_user_id, @created_at, @updated_at)
    `);
    stmt.run({
      plan_id: plan.plan_id,
      org_id: plan.org_id,
      initiative_id: plan.initiative_id ?? null,
      owner_user_id: plan.owner_user_id ?? null,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    });
    return plan;
  }

  getPlan(planId: string): Plan | null {
    const stmt = this.db.prepare<string, PlanRow>(`
      SELECT plan_id, org_id, initiative_id, owner_user_id, created_at, updated_at
      FROM plans
      WHERE plan_id = ?
    `);
    const row = stmt.get(planId);
    if (!row) return null;
    return this.rowToPlan(row);
  }

  updatePlan(planId: string, updates?: { initiative_id?: string | null }): Plan | null {
    const now = new Date().toISOString();

    if (updates?.initiative_id !== undefined) {
      const stmt = this.db.prepare(`
        UPDATE plans
        SET initiative_id = ?, updated_at = ?
        WHERE plan_id = ?
      `);
      const result = stmt.run(updates.initiative_id ?? null, now, planId);
      if (result.changes === 0) return null;
    } else {
      const stmt = this.db.prepare(`
        UPDATE plans
        SET updated_at = ?
        WHERE plan_id = ?
      `);
      const result = stmt.run(now, planId);
      if (result.changes === 0) return null;
    }

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

  listPlans(filter?: PlanFilter): Plan[] {
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter?.org_id) {
      whereClauses.push('p.org_id = @org_id');
      params.org_id = filter.org_id;
    }
    if (filter?.initiative_id) {
      whereClauses.push('p.initiative_id = @initiative_id');
      params.initiative_id = filter.initiative_id;
    }
    if (filter?.owner_user_id) {
      whereClauses.push('p.owner_user_id = @owner_user_id');
      params.owner_user_id = filter.owner_user_id;
    }
    if (filter?.status) {
      whereClauses.push('v.status = @status');
      params.status = filter.status;
    }

    let sql: string;
    if (filter?.status) {
      // Need to join with versions to filter by status
      sql = `
        SELECT DISTINCT p.plan_id, p.org_id, p.initiative_id, p.owner_user_id, p.created_at, p.updated_at
        FROM plans p
        INNER JOIN versions v ON p.plan_id = v.plan_id
        ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
        ORDER BY p.updated_at DESC
      `;
    } else {
      sql = `
        SELECT plan_id, org_id, initiative_id, owner_user_id, created_at, updated_at
        FROM plans p
        ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
        ORDER BY updated_at DESC
      `;
    }

    const stmt = this.db.prepare<Record<string, unknown>, PlanRow>(sql);
    const rows = stmt.all(whereClauses.length > 0 ? params : {});
    return rows.map((row) => this.rowToPlan(row));
  }

  listPlansWithAttention(filter?: PlanFilter): PlanWithAttentionData[] {
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter?.org_id) {
      whereClauses.push('p.org_id = @org_id');
      params.org_id = filter.org_id;
    }
    if (filter?.initiative_id) {
      whereClauses.push('p.initiative_id = @initiative_id');
      params.initiative_id = filter.initiative_id;
    }
    if (filter?.owner_user_id) {
      whereClauses.push('p.owner_user_id = @owner_user_id');
      params.owner_user_id = filter.owner_user_id;
    }
    if (filter?.status) {
      whereClauses.push('v.status = @status');
      params.status = filter.status;
    }

    // Single query with LEFT JOINs to get plans with latest version and attention counts
    const sql = `
      SELECT
        p.plan_id,
        p.org_id,
        p.initiative_id,
        p.owner_user_id,
        p.created_at as plan_created_at,
        p.updated_at as plan_updated_at,
        v.version,
        v.status,
        v.summary_json,
        v.submitted_at,
        v.approval_info_json,
        v.change_request_id,
        v.metadata_json,
        v.created_at as version_created_at,
        v.updated_at as version_updated_at,
        COALESCE(cr_count.pending_count, 0) as pending_change_request_count,
        COALESCE(comment_count.unresolved_count, 0) as unresolved_comment_count
      FROM plans p
      INNER JOIN versions v ON p.plan_id = v.plan_id
      INNER JOIN (
        SELECT plan_id, MAX(version) as max_version
        FROM versions
        GROUP BY plan_id
      ) latest ON v.plan_id = latest.plan_id AND v.version = latest.max_version
      LEFT JOIN (
        SELECT plan_id, COUNT(*) as pending_count
        FROM change_requests
        WHERE status = 'pending'
        GROUP BY plan_id
      ) cr_count ON p.plan_id = cr_count.plan_id
      LEFT JOIN (
        SELECT plan_id, version, COUNT(*) as unresolved_count
        FROM comments
        WHERE resolved = 0
        GROUP BY plan_id, version
      ) comment_count ON v.plan_id = comment_count.plan_id AND v.version = comment_count.version
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ORDER BY p.updated_at DESC
    `;

    const stmt = this.db.prepare<Record<string, unknown>, PlanWithAttentionRow>(sql);
    const rows = stmt.all(whereClauses.length > 0 ? params : {});

    return rows.map((row) => {
      const steps = this.getStepsForVersion(row.plan_id, row.version);
      return {
        plan: {
          plan_id: row.plan_id,
          org_id: row.org_id,
          initiative_id: row.initiative_id ?? undefined,
          owner_user_id: row.owner_user_id ?? undefined,
          created_at: row.plan_created_at,
          updated_at: row.plan_updated_at,
        },
        latestVersion: this.rowToVersion(
          {
            plan_id: row.plan_id,
            version: row.version,
            status: row.status,
            summary_json: row.summary_json,
            submitted_at: row.submitted_at,
            approval_info_json: row.approval_info_json,
            change_request_id: row.change_request_id,
            metadata_json: row.metadata_json,
            created_at: row.version_created_at,
            updated_at: row.version_updated_at,
          },
          steps
        ),
        pendingChangeRequestCount: row.pending_change_request_count,
        unresolvedCommentCount: row.unresolved_comment_count,
      };
    });
  }

  // ============================================
  // Version operations
  // ============================================

  createVersion(version: PlanVersion): PlanVersion {
    const transaction = this.db.transaction(() => {
      // Insert version
      const versionStmt = this.db.prepare(`
        INSERT INTO versions (plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at)
        VALUES (@plan_id, @version, @status, @summary_json, @submitted_at, @approval_info_json, @change_request_id, @metadata_json, @created_at, @updated_at)
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
        metadata_json: version.metadata ? JSON.stringify(version.metadata) : null,
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
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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
      SELECT plan_id, version, status, summary_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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

  private rowToOrganization(row: OrganizationRow): Organization {
    return {
      org_id: row.org_id,
      name: row.name,
      slug: row.slug,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToInitiative(row: InitiativeRow): Initiative {
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

  private rowToPlan(row: PlanRow): Plan {
    return {
      plan_id: row.plan_id,
      org_id: row.org_id,
      initiative_id: row.initiative_id ?? undefined,
      owner_user_id: row.owner_user_id ?? undefined,
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
    if (row.metadata_json) {
      version.metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
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
  // Question operations
  // ============================================

  createQuestion(question: Question): Question {
    const stmt = this.db.prepare(`
      INSERT INTO questions (
        question_id, plan_id, agent_id, agent_role, text, context,
        options_json, blocking_level, steps_blocked, can_use_default,
        default_value, subscribers_json, merged_from_json, status,
        answer, answered_at, priority_score, created_at, updated_at
      )
      VALUES (
        @question_id, @plan_id, @agent_id, @agent_role, @text, @context,
        @options_json, @blocking_level, @steps_blocked, @can_use_default,
        @default_value, @subscribers_json, @merged_from_json, @status,
        @answer, @answered_at, @priority_score, @created_at, @updated_at
      )
    `);
    stmt.run({
      question_id: question.question_id,
      plan_id: question.plan_id,
      agent_id: question.agent_id,
      agent_role: question.agent_role,
      text: question.text,
      context: question.context ?? null,
      options_json: question.options ? JSON.stringify(question.options) : null,
      blocking_level: question.blocking_level,
      steps_blocked: question.steps_blocked,
      can_use_default: question.can_use_default ? 1 : 0,
      default_value: question.default_value ?? null,
      subscribers_json: JSON.stringify(question.subscribers),
      merged_from_json: JSON.stringify(question.merged_from),
      status: question.status,
      answer: question.answer ?? null,
      answered_at: question.answered_at ?? null,
      priority_score: question.priority_score,
      created_at: question.created_at,
      updated_at: question.updated_at,
    });
    return question;
  }

  getQuestion(questionId: string): Question | null {
    const stmt = this.db.prepare<string, QuestionRow>(`
      SELECT question_id, plan_id, agent_id, agent_role, text, context,
             options_json, blocking_level, steps_blocked, can_use_default,
             default_value, subscribers_json, merged_from_json, status,
             answer, answered_at, priority_score, created_at, updated_at
      FROM questions
      WHERE question_id = ?
    `);
    const row = stmt.get(questionId);
    if (!row) return null;
    return this.rowToQuestion(row);
  }

  updateQuestion(questionId: string, updates: Partial<Question>): Question | null {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = @updated_at'];
    const values: Record<string, unknown> = { question_id: questionId, updated_at: now };

    if (updates.text !== undefined) {
      fields.push('text = @text');
      values.text = updates.text;
    }
    if (updates.context !== undefined) {
      fields.push('context = @context');
      values.context = updates.context ?? null;
    }
    if (updates.options !== undefined) {
      fields.push('options_json = @options_json');
      values.options_json = updates.options ? JSON.stringify(updates.options) : null;
    }
    if (updates.blocking_level !== undefined) {
      fields.push('blocking_level = @blocking_level');
      values.blocking_level = updates.blocking_level;
    }
    if (updates.steps_blocked !== undefined) {
      fields.push('steps_blocked = @steps_blocked');
      values.steps_blocked = updates.steps_blocked;
    }
    if (updates.can_use_default !== undefined) {
      fields.push('can_use_default = @can_use_default');
      values.can_use_default = updates.can_use_default ? 1 : 0;
    }
    if (updates.default_value !== undefined) {
      fields.push('default_value = @default_value');
      values.default_value = updates.default_value ?? null;
    }
    if (updates.subscribers !== undefined) {
      fields.push('subscribers_json = @subscribers_json');
      values.subscribers_json = JSON.stringify(updates.subscribers);
    }
    if (updates.merged_from !== undefined) {
      fields.push('merged_from_json = @merged_from_json');
      values.merged_from_json = JSON.stringify(updates.merged_from);
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.answer !== undefined) {
      fields.push('answer = @answer');
      values.answer = updates.answer ?? null;
    }
    if (updates.answered_at !== undefined) {
      fields.push('answered_at = @answered_at');
      values.answered_at = updates.answered_at ?? null;
    }
    if (updates.priority_score !== undefined) {
      fields.push('priority_score = @priority_score');
      values.priority_score = updates.priority_score;
    }

    const stmt = this.db.prepare(`
      UPDATE questions
      SET ${fields.join(', ')}
      WHERE question_id = @question_id
    `);
    const result = stmt.run(values);
    if (result.changes === 0) return null;
    return this.getQuestion(questionId);
  }

  answerQuestion(questionId: string, answer: string): Question | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE questions
      SET status = 'answered', answer = ?, answered_at = ?, updated_at = ?
      WHERE question_id = ?
    `);
    const result = stmt.run(answer, now, now, questionId);
    if (result.changes === 0) return null;
    return this.getQuestion(questionId);
  }

  dismissQuestion(questionId: string): Question | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE questions
      SET status = 'dismissed', updated_at = ?
      WHERE question_id = ?
    `);
    const result = stmt.run(now, questionId);
    if (result.changes === 0) return null;
    return this.getQuestion(questionId);
  }

  subscribeToQuestion(questionId: string, agentId: string): Question | null {
    const question = this.getQuestion(questionId);
    if (!question) return null;

    // Don't add duplicate subscribers
    if (question.subscribers.includes(agentId)) {
      return question;
    }

    const newSubscribers = [...question.subscribers, agentId];
    const newPriorityScore = calculatePriorityScore(
      question.blocking_level,
      question.steps_blocked,
      newSubscribers.length,
      question.created_at
    );

    return this.updateQuestion(questionId, {
      subscribers: newSubscribers,
      priority_score: newPriorityScore,
    });
  }

  mergeQuestions(targetId: string, duplicateId: string): Question | null {
    const target = this.getQuestion(targetId);
    const duplicate = this.getQuestion(duplicateId);
    if (!target || !duplicate) return null;

    const newMergedFrom = [...target.merged_from, duplicateId];
    const newSubscribers = target.subscribers.includes(duplicate.agent_id)
      ? target.subscribers
      : [...target.subscribers, duplicate.agent_id];

    const newPriorityScore = calculatePriorityScore(
      target.blocking_level,
      target.steps_blocked,
      newSubscribers.length,
      target.created_at
    );

    // Update target with merged data
    const updated = this.updateQuestion(targetId, {
      merged_from: newMergedFrom,
      subscribers: newSubscribers,
      priority_score: newPriorityScore,
    });

    // Mark duplicate as dismissed
    this.dismissQuestion(duplicateId);

    return updated;
  }

  listQuestionsByPlan(planId: string, status?: QuestionStatus): Question[] {
    let sql = `
      SELECT question_id, plan_id, agent_id, agent_role, text, context,
             options_json, blocking_level, steps_blocked, can_use_default,
             default_value, subscribers_json, merged_from_json, status,
             answer, answered_at, priority_score, created_at, updated_at
      FROM questions
      WHERE plan_id = ?
    `;
    const params: unknown[] = [planId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY priority_score DESC, created_at ASC`;

    const stmt = this.db.prepare<unknown[], QuestionRow>(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => this.rowToQuestion(row));
  }

  listPendingQuestionsByPriority(planId: string): Question[] {
    return this.listQuestionsByPlan(planId, 'pending');
  }

  findDuplicateQuestions(planId: string, agentId: string, textPrefix: string): Question[] {
    // Find pending questions from same agent with similar text start
    const stmt = this.db.prepare<[string, string, string], QuestionRow>(`
      SELECT question_id, plan_id, agent_id, agent_role, text, context,
             options_json, blocking_level, steps_blocked, can_use_default,
             default_value, subscribers_json, merged_from_json, status,
             answer, answered_at, priority_score, created_at, updated_at
      FROM questions
      WHERE plan_id = ? AND agent_id = ? AND status = 'pending'
        AND text LIKE ? || '%'
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(planId, agentId, textPrefix);
    return rows.map((row) => this.rowToQuestion(row));
  }

  deleteQuestion(questionId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM questions
      WHERE question_id = ?
    `);
    const result = stmt.run(questionId);
    return result.changes > 0;
  }

  private rowToQuestion(row: QuestionRow): Question {
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

  // ============================================
  // Trajectory operations
  // ============================================

  createTrajectoryEvent(event: DecisionEvent): DecisionEvent {
    const stmt = this.db.prepare(`
      INSERT INTO trajectory_events (
        event_id, type, question_id, asking_agent, question_text,
        context_provided, options_presented_json, selected_option,
        free_text_response, reasoning, plan_id, step_id,
        agent_trajectory_ref, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.event_id,
      event.type,
      event.question_id,
      event.asking_agent,
      event.question_text,
      event.context_provided ?? null,
      JSON.stringify(event.options_presented),
      event.selected_option ?? null,
      event.free_text_response ?? null,
      event.reasoning ?? null,
      event.plan_id,
      event.step_id ?? null,
      event.agent_trajectory_ref ?? null,
      event.timestamp
    );

    return event;
  }

  getTrajectoryEvent(eventId: string): DecisionEvent | null {
    const stmt = this.db.prepare(`
      SELECT * FROM trajectory_events
      WHERE event_id = ?
    `);
    const row = stmt.get(eventId) as TrajectoryEventRow | undefined;
    return row ? this.rowToTrajectoryEvent(row) : null;
  }

  listTrajectoryEvents(planId: string, filter?: TrajectoryEventFilter): DecisionEvent[] {
    let query = `
      SELECT * FROM trajectory_events
      WHERE plan_id = ?
    `;
    const params: unknown[] = [planId];

    if (filter?.agent_id) {
      query += ` AND asking_agent = ?`;
      params.push(filter.agent_id);
    }

    if (filter?.event_type) {
      query += ` AND type = ?`;
      params.push(filter.event_type);
    }

    if (filter?.step_id) {
      query += ` AND step_id = ?`;
      params.push(filter.step_id);
    }

    if (filter?.from_date) {
      query += ` AND timestamp >= ?`;
      params.push(filter.from_date);
    }

    if (filter?.to_date) {
      query += ` AND timestamp <= ?`;
      params.push(filter.to_date);
    }

    query += ` ORDER BY timestamp DESC`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as TrajectoryEventRow[];
    return rows.map((row) => this.rowToTrajectoryEvent(row));
  }

  findSimilarQuestions(planId: string, text: string, threshold: number = 0.7): DecisionEvent[] {
    // Simple text similarity using word matching
    // For v1, we use a basic keyword-based similarity check
    // In production, you might want to use a more sophisticated similarity metric

    // Extract significant words (> 3 chars) from the query
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5); // Use top 5 words

    if (words.length === 0) {
      return [];
    }

    // Build a query that matches any of the keywords
    const conditions = words.map(() => 'LOWER(question_text) LIKE ?').join(' OR ');
    const params = [planId, ...words.map(w => `%${w}%`)];

    const stmt = this.db.prepare(`
      SELECT * FROM trajectory_events
      WHERE plan_id = ?
        AND (${conditions})
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    const rows = stmt.all(...params) as TrajectoryEventRow[];
    return rows.map((row) => this.rowToTrajectoryEvent(row));
  }

  deleteTrajectoryEvent(eventId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM trajectory_events
      WHERE event_id = ?
    `);
    const result = stmt.run(eventId);
    return result.changes > 0;
  }

  private rowToTrajectoryEvent(row: TrajectoryEventRow): DecisionEvent {
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
