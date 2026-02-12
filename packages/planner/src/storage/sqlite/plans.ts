import type Database from 'better-sqlite3';
import type { Plan, PlanVersion, PlanSource } from '../../domain/plan.js';
import type { Step } from '../../domain/step.js';
import type { PlanFilter, PlanWithAttentionData } from '../interface.js';
import { rowToPlan, rowToVersion } from './converters.js';
import type { PlanRow, VersionRow, StepRow } from './converters.js';

// ============================================
// Plan operations
// ============================================

export function createPlan(db: Database.Database, plan: Plan): Plan {
  const stmt = db.prepare(`
    INSERT INTO plans (plan_id, org_id, initiative_id, owner_user_id, source_json, created_at, updated_at)
    VALUES (@plan_id, @org_id, @initiative_id, @owner_user_id, @source_json, @created_at, @updated_at)
  `);
  stmt.run({
    plan_id: plan.plan_id,
    org_id: plan.org_id,
    initiative_id: plan.initiative_id ?? null,
    owner_user_id: plan.owner_user_id ?? null,
    source_json: JSON.stringify(plan.source ?? { type: 'manual' }),
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  });
  return plan;
}

export function getPlan(db: Database.Database, planId: string): Plan | null {
  const stmt = db.prepare<string, PlanRow>(`
    SELECT plan_id, org_id, initiative_id, owner_user_id, source_json, created_at, updated_at
    FROM plans
    WHERE plan_id = ?
  `);
  const row = stmt.get(planId);
  if (!row) return null;
  return rowToPlan(row);
}

export function updatePlan(
  db: Database.Database,
  planId: string,
  updates?: { initiative_id?: string | null }
): Plan | null {
  const now = new Date().toISOString();

  if (updates?.initiative_id !== undefined) {
    const stmt = db.prepare(`
      UPDATE plans
      SET initiative_id = ?, updated_at = ?
      WHERE plan_id = ?
    `);
    const result = stmt.run(updates.initiative_id ?? null, now, planId);
    if (result.changes === 0) return null;
  } else {
    const stmt = db.prepare(`
      UPDATE plans
      SET updated_at = ?
      WHERE plan_id = ?
    `);
    const result = stmt.run(now, planId);
    if (result.changes === 0) return null;
  }

  return getPlan(db, planId);
}

export function deletePlan(db: Database.Database, planId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM plans
    WHERE plan_id = ?
  `);
  const result = stmt.run(planId);
  return result.changes > 0;
}

export function listPlans(db: Database.Database, filter?: PlanFilter): Plan[] {
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
      SELECT DISTINCT p.plan_id, p.org_id, p.initiative_id, p.owner_user_id, p.source_json, p.created_at, p.updated_at
      FROM plans p
      INNER JOIN versions v ON p.plan_id = v.plan_id
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ORDER BY p.updated_at DESC
    `;
  } else {
    sql = `
      SELECT plan_id, org_id, initiative_id, owner_user_id, source_json, created_at, updated_at
      FROM plans p
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ORDER BY updated_at DESC
    `;
  }

  const stmt = db.prepare<Record<string, unknown>, PlanRow>(sql);
  const rows = stmt.all(whereClauses.length > 0 ? params : {});
  return rows.map((row) => rowToPlan(row));
}

// ============================================
// Helper: Get steps for a version
// ============================================

export function getStepsForVersion(db: Database.Database, planId: string, version: number): Step[] {
  const stepStmt = db.prepare<[string, number], StepRow>(`
    SELECT plan_id, version, step_id, step_order, step_json
    FROM steps
    WHERE plan_id = ? AND version = ?
    ORDER BY step_order ASC
  `);
  const stepRows = stepStmt.all(planId, version);
  return stepRows.map((row) => JSON.parse(row.step_json) as Step);
}

// ============================================
// Plans with attention data
// ============================================

interface PlanWithAttentionRow {
  plan_id: string;
  org_id: string;
  initiative_id: string | null;
  owner_user_id: string | null;
  source_json: string;
  plan_created_at: string;
  plan_updated_at: string;
  version: number;
  status: string;
  summary_json: string;
  understanding_json: string | null;
  context_json: string | null;
  submitted_at: string | null;
  approval_info_json: string | null;
  change_request_id: string | null;
  metadata_json: string | null;
  version_created_at: string;
  version_updated_at: string;
  pending_change_request_count: number;
  unresolved_comment_count: number;
}

export function listPlansWithAttention(
  db: Database.Database,
  filter?: PlanFilter
): PlanWithAttentionData[] {
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
      p.source_json,
      p.created_at as plan_created_at,
      p.updated_at as plan_updated_at,
      v.version,
      v.status,
      v.summary_json,
      v.understanding_json,
      v.context_json,
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

  const stmt = db.prepare<Record<string, unknown>, PlanWithAttentionRow>(sql);
  const rows = stmt.all(whereClauses.length > 0 ? params : {});

  return rows.map((row) => {
    const steps = getStepsForVersion(db, row.plan_id, row.version);
    return {
      plan: {
        plan_id: row.plan_id,
        org_id: row.org_id,
        initiative_id: row.initiative_id ?? undefined,
        owner_user_id: row.owner_user_id ?? undefined,
        source: JSON.parse(row.source_json) as PlanSource,
        created_at: row.plan_created_at,
        updated_at: row.plan_updated_at,
      },
      latestVersion: rowToVersion(
        {
          plan_id: row.plan_id,
          version: row.version,
          status: row.status,
          summary_json: row.summary_json,
          understanding_json: row.understanding_json,
          context_json: row.context_json,
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
