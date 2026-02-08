import type Database from 'better-sqlite3';
import type { PlanVersion } from '../../domain/plan.js';
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
      INSERT INTO versions (plan_id, version, status, summary_json, understanding_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at)
      VALUES (@plan_id, @version, @status, @summary_json, @understanding_json, @submitted_at, @approval_info_json, @change_request_id, @metadata_json, @created_at, @updated_at)
    `);
    versionStmt.run({
      plan_id: version.plan_id,
      version: version.version,
      status: version.status,
      summary_json: JSON.stringify(version.summary),
      understanding_json: JSON.stringify(version.understanding ?? {}),
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
    SELECT plan_id, version, status, summary_json, understanding_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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
    SELECT plan_id, version, status, summary_json, understanding_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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
    SELECT plan_id, version, status, summary_json, understanding_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
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
