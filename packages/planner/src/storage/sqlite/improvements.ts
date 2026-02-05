import type Database from 'better-sqlite3';
import type { Improvement, ImprovementStatus } from '../../domain/improvement.js';
import { rowToImprovement } from './converters.js';
import type { ImprovementRow } from './converters.js';

// ============================================
// Improvement operations
// ============================================

export function createImprovement(db: Database.Database, improvement: Improvement): Improvement {
  const stmt = db.prepare(`
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

export function getImprovement(db: Database.Database, improvementId: string): Improvement | null {
  const stmt = db.prepare<string, ImprovementRow>(`
    SELECT improvement_id, plan_id, version, step_id, type, description,
           suggested_change_json, status, created_at, updated_at
    FROM improvements
    WHERE improvement_id = ?
  `);
  const row = stmt.get(improvementId);
  if (!row) return null;
  return rowToImprovement(row);
}

export function updateImprovementStatus(
  db: Database.Database,
  improvementId: string,
  status: ImprovementStatus
): Improvement | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE improvements
    SET status = ?, updated_at = ?
    WHERE improvement_id = ?
  `);
  const result = stmt.run(status, now, improvementId);
  if (result.changes === 0) return null;
  return getImprovement(db, improvementId);
}

export function listImprovementsByVersion(
  db: Database.Database,
  planId: string,
  version: number
): Improvement[] {
  const stmt = db.prepare<[string, number], ImprovementRow>(`
    SELECT improvement_id, plan_id, version, step_id, type, description,
           suggested_change_json, status, created_at, updated_at
    FROM improvements
    WHERE plan_id = ? AND version = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(planId, version);
  return rows.map((row) => rowToImprovement(row));
}

export function listImprovementsByStep(
  db: Database.Database,
  planId: string,
  version: number,
  stepId: string
): Improvement[] {
  const stmt = db.prepare<[string, number, string], ImprovementRow>(`
    SELECT improvement_id, plan_id, version, step_id, type, description,
           suggested_change_json, status, created_at, updated_at
    FROM improvements
    WHERE plan_id = ? AND version = ? AND step_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(planId, version, stepId);
  return rows.map((row) => rowToImprovement(row));
}

export function listPendingImprovements(
  db: Database.Database,
  planId: string,
  version: number
): Improvement[] {
  const stmt = db.prepare<[string, number], ImprovementRow>(`
    SELECT improvement_id, plan_id, version, step_id, type, description,
           suggested_change_json, status, created_at, updated_at
    FROM improvements
    WHERE plan_id = ? AND version = ? AND status = 'pending'
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(planId, version);
  return rows.map((row) => rowToImprovement(row));
}

export function deleteImprovement(db: Database.Database, improvementId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM improvements
    WHERE improvement_id = ?
  `);
  const result = stmt.run(improvementId);
  return result.changes > 0;
}
