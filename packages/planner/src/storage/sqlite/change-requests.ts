import type Database from 'better-sqlite3';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  RevisionStatus,
} from '../../domain/change-request.js';
import type { PlanVersion } from '../../domain/plan.js';
import { rowToChangeRequest, rowToVersion } from './converters.js';
import type { ChangeRequestRow, VersionRow } from './converters.js';
import { getStepsForVersion } from './plans.js';

// ============================================
// Change request operations
// ============================================

export function createChangeRequest(
  db: Database.Database,
  changeRequest: ChangeRequest
): ChangeRequest {
  const stmt = db.prepare(`
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

export function getChangeRequest(
  db: Database.Database,
  changeRequestId: string
): ChangeRequest | null {
  const stmt = db.prepare<string, ChangeRequestRow>(`
    SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
           status, result_version, revision_session_id, revision_status, created_at, updated_at
    FROM change_requests
    WHERE change_request_id = ?
  `);
  const row = stmt.get(changeRequestId);
  if (!row) return null;
  return rowToChangeRequest(row);
}

export function updateChangeRequestStatus(
  db: Database.Database,
  changeRequestId: string,
  status: ChangeRequestStatus,
  resultVersion?: number
): ChangeRequest | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE change_requests
    SET status = ?, result_version = ?, updated_at = ?
    WHERE change_request_id = ?
  `);
  const result = stmt.run(status, resultVersion ?? null, now, changeRequestId);
  if (result.changes === 0) return null;
  return getChangeRequest(db, changeRequestId);
}

export function updateChangeRequestRevisionStatus(
  db: Database.Database,
  changeRequestId: string,
  revisionSessionId: string | null,
  revisionStatus: RevisionStatus
): ChangeRequest | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE change_requests
    SET revision_session_id = ?, revision_status = ?, updated_at = ?
    WHERE change_request_id = ?
  `);
  const result = stmt.run(revisionSessionId, revisionStatus, now, changeRequestId);
  if (result.changes === 0) return null;
  return getChangeRequest(db, changeRequestId);
}

export function listChangeRequestsByPlan(db: Database.Database, planId: string): ChangeRequest[] {
  const stmt = db.prepare<string, ChangeRequestRow>(`
    SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
           status, result_version, revision_session_id, revision_status, created_at, updated_at
    FROM change_requests
    WHERE plan_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(planId);
  return rows.map((row) => rowToChangeRequest(row));
}

export function listChangeRequestsByRun(db: Database.Database, runId: string): ChangeRequest[] {
  const stmt = db.prepare<string, ChangeRequestRow>(`
    SELECT change_request_id, run_id, plan_id, reason, suggested_changes_json,
           status, result_version, revision_session_id, revision_status, created_at, updated_at
    FROM change_requests
    WHERE run_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToChangeRequest(row));
}

export function getVersionByChangeRequest(
  db: Database.Database,
  changeRequestId: string
): PlanVersion | null {
  const versionStmt = db.prepare<string, VersionRow>(`
    SELECT plan_id, version, status, summary_json, understanding_json, submitted_at, approval_info_json, change_request_id, metadata_json, created_at, updated_at
    FROM versions
    WHERE change_request_id = ?
  `);
  const versionRow = versionStmt.get(changeRequestId);
  if (!versionRow) return null;

  const steps = getStepsForVersion(db, versionRow.plan_id, versionRow.version);
  return rowToVersion(versionRow, steps);
}
