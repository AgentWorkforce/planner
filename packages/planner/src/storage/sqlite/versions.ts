import type Database from 'better-sqlite3';
import type { PlanVersion } from '../../domain/plan.js';
import type { Context } from '../../domain/context.js';
import type { Understanding } from '../../domain/plan.js';
import type { PlanStatus } from '../../domain/status.js';
import { rowToVersion } from './converters.js';
import type { VersionRow } from './converters.js';
import { getStepsForVersion } from './plans.js';

// ============================================
// Version operations
// ============================================

export function createVersion(db: Database.Database, version: PlanVersion): PlanVersion {
  const transaction = db.transaction(() => {
    // Insert version
    const versionStmt = db.prepare(`
      INSERT INTO versions (plan_id, version, status, summary_json, understanding_json, context_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at)
      VALUES (@plan_id, @version, @status, @summary_json, @understanding_json, @context_json, @submitted_at, @approval_info_json, @change_request_id, @metadata_json, @created_at, @updated_at)
    `);
    versionStmt.run({
      plan_id: version.plan_id,
      version: version.version,
      status: version.status,
      summary_json: JSON.stringify(version.summary),
      understanding_json: JSON.stringify(version.understanding ?? {}),
      context_json: JSON.stringify(version.context ?? {}),
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
    const stepStmt = db.prepare(`
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
    const updatePlanStmt = db.prepare(`
      UPDATE plans SET updated_at = ? WHERE plan_id = ?
    `);
    updatePlanStmt.run(version.updated_at, version.plan_id);
  });

  transaction();
  return version;
}

export function getVersion(
  db: Database.Database,
  planId: string,
  version: number
): PlanVersion | null {
  const versionStmt = db.prepare<[string, number], VersionRow>(`
    SELECT plan_id, version, status, summary_json, understanding_json, context_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
    FROM versions
    WHERE plan_id = ? AND version = ?
  `);
  const versionRow = versionStmt.get(planId, version);
  if (!versionRow) return null;

  const steps = getStepsForVersion(db, planId, version);
  return rowToVersion(versionRow, steps);
}

export function getLatestVersion(db: Database.Database, planId: string): PlanVersion | null {
  const versionStmt = db.prepare<string, VersionRow>(`
    SELECT plan_id, version, status, summary_json, understanding_json, context_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
    FROM versions
    WHERE plan_id = ?
    ORDER BY version DESC
    LIMIT 1
  `);
  const versionRow = versionStmt.get(planId);
  if (!versionRow) return null;

  const steps = getStepsForVersion(db, planId, versionRow.version);
  return rowToVersion(versionRow, steps);
}

export function listVersions(db: Database.Database, planId: string): PlanVersion[] {
  const versionStmt = db.prepare<string, VersionRow>(`
    SELECT plan_id, version, status, summary_json, understanding_json, context_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
    FROM versions
    WHERE plan_id = ?
    ORDER BY version ASC
  `);
  const versionRows = versionStmt.all(planId);

  return versionRows.map((row) => {
    const steps = getStepsForVersion(db, row.plan_id, row.version);
    return rowToVersion(row, steps);
  });
}

export function updateVersionStatus(
  db: Database.Database,
  planId: string,
  version: number,
  status: PlanStatus
): PlanVersion | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE versions
    SET status = ?, updated_at = ?
    WHERE plan_id = ? AND version = ?
  `);
  const result = stmt.run(status, now, planId, version);
  if (result.changes === 0) return null;

  // Also update plan's updated_at
  const updatePlanStmt = db.prepare(`
    UPDATE plans SET updated_at = ? WHERE plan_id = ?
  `);
  updatePlanStmt.run(now, planId);

  return getVersion(db, planId, version);
}

export function updateVersionContext(
  db: Database.Database,
  planId: string,
  version: number,
  context: Context
): PlanVersion | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE versions
    SET context_json = ?, updated_at = ?
    WHERE plan_id = ? AND version = ?
  `);
  const result = stmt.run(JSON.stringify(context), now, planId, version);
  if (result.changes === 0) return null;

  const updatePlanStmt = db.prepare(`
    UPDATE plans SET updated_at = ? WHERE plan_id = ?
  `);
  updatePlanStmt.run(now, planId);

  return getVersion(db, planId, version);
}

export function updateVersionUnderstanding(
  db: Database.Database,
  planId: string,
  version: number,
  understanding: Understanding
): PlanVersion | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE versions
    SET understanding_json = ?, updated_at = ?
    WHERE plan_id = ? AND version = ?
  `);
  const result = stmt.run(JSON.stringify(understanding), now, planId, version);
  if (result.changes === 0) return null;

  const updatePlanStmt = db.prepare(`
    UPDATE plans SET updated_at = ? WHERE plan_id = ?
  `);
  updatePlanStmt.run(now, planId);

  return getVersion(db, planId, version);
}

// ============================================
// Sub-plan hierarchy queries
// ============================================

/**
 * Find all plan_ids referenced as sub_plan_id in the latest version's steps.
 */
export function getSubPlanIds(db: Database.Database, planId: string): string[] {
  const latestRow = db.prepare<string, { version: number }>(`
    SELECT MAX(version) as version FROM versions WHERE plan_id = ?
  `).get(planId);
  if (!latestRow?.version) return [];

  const rows = db.prepare<[string, number], { sub_plan_id: string }>(`
    SELECT DISTINCT json_extract(step_json, '$.sub_plan_id') as sub_plan_id
    FROM steps
    WHERE plan_id = ? AND version = ?
    AND json_extract(step_json, '$.sub_plan_id') IS NOT NULL
  `).all(planId, latestRow.version);

  return rows.map(r => r.sub_plan_id);
}

/**
 * Find all plans that reference the given planId as a sub_plan_id
 * in their latest version's steps.
 */
export function getDependentPlanIds(db: Database.Database, planId: string): string[] {
  const rows = db.prepare<string, { plan_id: string }>(`
    SELECT DISTINCT s.plan_id
    FROM steps s
    INNER JOIN (
      SELECT plan_id, MAX(version) as latest_version
      FROM versions
      GROUP BY plan_id
    ) lv ON s.plan_id = lv.plan_id AND s.version = lv.latest_version
    WHERE json_extract(s.step_json, '$.sub_plan_id') = ?
  `).all(planId);

  return rows.map(r => r.plan_id);
}
