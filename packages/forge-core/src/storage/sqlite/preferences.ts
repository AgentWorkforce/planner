import type Database from 'better-sqlite3';
import type { DerivedPreference, UserTrajectoryScope } from '../../domain/user-trajectory.js';
import { type DerivedPreferenceRow, rowToDerivedPreference } from './converters.js';

export function createPreference(db: Database.Database, preference: DerivedPreference): DerivedPreference {
  const stmt = db.prepare(`
    INSERT INTO user_preferences (
      preference_id, user_id, scope, project_id, run_id, category, value,
      confidence, evidence_count, last_expressed, is_override, created_at, updated_at
    )
    VALUES (
      @preference_id, @user_id, @scope, @project_id, @run_id, @category, @value,
      @confidence, @evidence_count, @last_expressed, @is_override, @created_at, @updated_at
    )
  `);
  stmt.run({
    preference_id: preference.preference_id,
    user_id: preference.user_id,
    scope: preference.scope,
    project_id: preference.project_id ?? null,
    run_id: preference.run_id ?? null,
    category: preference.category,
    value: preference.value,
    confidence: preference.confidence,
    evidence_count: preference.evidence_count,
    last_expressed: preference.last_expressed,
    is_override: preference.is_override ? 1 : 0,
    created_at: preference.created_at,
    updated_at: preference.updated_at,
  });
  return preference;
}

export function getPreference(
  db: Database.Database,
  userId: string,
  scope: UserTrajectoryScope,
  category: string,
  projectId?: string,
  runId?: string
): DerivedPreference | null {
  let sql = `
    SELECT preference_id, user_id, scope, project_id, run_id, category, value,
           confidence, evidence_count, last_expressed, is_override, created_at, updated_at
    FROM user_preferences
    WHERE user_id = ? AND scope = ? AND category = ?
  `;
  const params: unknown[] = [userId, scope, category];

  if (projectId !== undefined) {
    sql += ' AND (project_id = ? OR project_id IS NULL)';
    params.push(projectId);
  } else {
    sql += ' AND project_id IS NULL';
  }

  if (runId !== undefined) {
    sql += ' AND (run_id = ? OR run_id IS NULL)';
    params.push(runId);
  } else {
    sql += ' AND run_id IS NULL';
  }

  const stmt = db.prepare<unknown[], DerivedPreferenceRow>(sql);
  const row = stmt.get(...params);
  if (!row) return null;
  return rowToDerivedPreference(row);
}

export function upsertPreference(db: Database.Database, preference: DerivedPreference): DerivedPreference {
  const stmt = db.prepare(`
    INSERT INTO user_preferences (
      preference_id, user_id, scope, project_id, run_id, category, value,
      confidence, evidence_count, last_expressed, is_override, created_at, updated_at
    )
    VALUES (
      @preference_id, @user_id, @scope, @project_id, @run_id, @category, @value,
      @confidence, @evidence_count, @last_expressed, @is_override, @created_at, @updated_at
    )
    ON CONFLICT (user_id, scope, category, project_id, run_id)
    DO UPDATE SET
      value = @value,
      confidence = @confidence,
      evidence_count = @evidence_count,
      last_expressed = @last_expressed,
      is_override = @is_override,
      updated_at = @updated_at
  `);
  stmt.run({
    preference_id: preference.preference_id,
    user_id: preference.user_id,
    scope: preference.scope,
    project_id: preference.project_id ?? null,
    run_id: preference.run_id ?? null,
    category: preference.category,
    value: preference.value,
    confidence: preference.confidence,
    evidence_count: preference.evidence_count,
    last_expressed: preference.last_expressed,
    is_override: preference.is_override ? 1 : 0,
    created_at: preference.created_at,
    updated_at: preference.updated_at,
  });
  return preference;
}

export function listPreferences(
  db: Database.Database,
  userId: string,
  scope?: UserTrajectoryScope,
  projectId?: string,
  runId?: string
): DerivedPreference[] {
  let sql = `
    SELECT preference_id, user_id, scope, project_id, run_id, category, value,
           confidence, evidence_count, last_expressed, is_override, created_at, updated_at
    FROM user_preferences
    WHERE user_id = ?
  `;
  const params: unknown[] = [userId];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }
  if (projectId) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }
  if (runId) {
    sql += ' AND run_id = ?';
    params.push(runId);
  }

  sql += ' ORDER BY confidence DESC, last_expressed DESC';

  const stmt = db.prepare<unknown[], DerivedPreferenceRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToDerivedPreference(row));
}

export function getPreferencesAboveThreshold(
  db: Database.Database,
  userId: string,
  threshold: number,
  scope?: UserTrajectoryScope
): DerivedPreference[] {
  let sql = `
    SELECT preference_id, user_id, scope, project_id, run_id, category, value,
           confidence, evidence_count, last_expressed, is_override, created_at, updated_at
    FROM user_preferences
    WHERE user_id = ? AND confidence >= ?
  `;
  const params: unknown[] = [userId, threshold];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }

  sql += ' ORDER BY confidence DESC, last_expressed DESC';

  const stmt = db.prepare<unknown[], DerivedPreferenceRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToDerivedPreference(row));
}

export function deletePreference(db: Database.Database, preferenceId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM user_preferences
    WHERE preference_id = ?
  `);
  const result = stmt.run(preferenceId);
  return result.changes > 0;
}
