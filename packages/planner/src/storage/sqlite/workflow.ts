import type Database from 'better-sqlite3';
import type { PlanVersion } from '../../domain/plan.js';
import type { ApprovalInfo } from '../../domain/workflow.js';
import { getVersion } from './versions.js';
import { emitPlanQualitySignal } from '../../tuner/quality-signal.js';
import { getPlan } from './plans.js';

// ============================================
// Workflow operations
// ============================================

export function submitVersion(
  db: Database.Database,
  planId: string,
  version: number
): PlanVersion | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE versions
    SET submitted_at = ?, updated_at = ?
    WHERE plan_id = ? AND version = ?
  `);
  const result = stmt.run(now, now, planId, version);
  if (result.changes === 0) return null;

  // Also update plan's updated_at
  const updatePlanStmt = db.prepare(`
    UPDATE plans SET updated_at = ? WHERE plan_id = ?
  `);
  updatePlanStmt.run(now, planId);

  return getVersion(db, planId, version);
}

export function approveVersion(
  db: Database.Database,
  planId: string,
  version: number,
  approvalInfo: ApprovalInfo
): PlanVersion | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
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
  const updatePlanStmt = db.prepare(`
    UPDATE plans SET updated_at = ? WHERE plan_id = ?
  `);
  updatePlanStmt.run(now, planId);

  // Get the approved version to return
  const approvedVersion = getVersion(db, planId, version);

  // Emit quality signal for ideation-sourced plans (fire-and-forget)
  if (approvedVersion) {
    const plan = getPlan(db, planId);
    if (plan && plan.source) {
      emitPlanQualitySignal(db, {
        plan_id: planId,
        version,
        source: plan.source,
        created_at: plan.created_at,
      }).catch((error) => {
        // Fire-and-forget: log error but don't fail the approval
        console.error('[workflow] Failed to emit quality signal:', error);
      });
    }
  }

  return approvedVersion;
}
