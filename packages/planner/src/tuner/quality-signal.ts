import type Database from 'better-sqlite3';
import { getDefaultTunerClient } from './client.js';
import { z } from 'zod';

// ============================================
// PlanQualitySignal Schema (from tuner package)
// ============================================

const PlanQualitySignalSchema = z.object({
  plan_id: z.string(),
  plan_version: z.number().int().min(1),
  session_id: z.string(),
  question_count: z.number().int().min(0),
  version_count: z.number().int().min(1),
  improvements_made: z.number().int().min(0),
  block_count: z.number().int().min(0),
  time_to_approval_ms: z.number().int().min(0),
  source: z.enum(['test', 'production', 'training']).default('production'),
  timestamp: z.string().datetime(),
});

type PlanQualitySignal = z.infer<typeof PlanQualitySignalSchema>;

// ============================================
// Types
// ============================================

interface PlanSource {
  type: string;
  session_id?: string;
}

interface PlanData {
  plan_id: string;
  version: number;
  source: PlanSource;
  created_at: string;
}

// ============================================
// Quality Signal Emission
// ============================================

/**
 * Emit PlanQualitySignal for an approved plan.
 * Only emits if the plan source is 'ideation'.
 * Fire-and-forget - never blocks the approval flow.
 */
export async function emitPlanQualitySignal(
  db: Database.Database,
  planData: PlanData
): Promise<void> {
  // Only emit for ideation-sourced plans
  if (planData.source.type !== 'ideation' || !planData.source.session_id) {
    console.log(`[quality-signal] Skipping non-ideation plan ${planData.plan_id}`);
    return;
  }

  const client = getDefaultTunerClient();
  if (client.getStatus() === 'disabled') {
    console.log(`[quality-signal] Tuner disabled, skipping signal for ${planData.plan_id}`);
    return;
  }

  try {
    // Gather quality metrics from plan data
    const metrics = gatherPlanMetrics(db, planData.plan_id);

    const signal: PlanQualitySignal = {
      plan_id: planData.plan_id,
      plan_version: planData.version,
      session_id: planData.source.session_id,
      question_count: metrics.questionCount,
      version_count: metrics.versionCount,
      improvements_made: metrics.improvementCount,
      block_count: metrics.blockCount,
      time_to_approval_ms: Date.now() - new Date(planData.created_at).getTime(),
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    console.log(`[quality-signal] Emitting signal for plan ${planData.plan_id} (session: ${planData.source.session_id})`);

    // Fire-and-forget
    void submitPlanQualitySignal(client, signal);
  } catch (error) {
    console.error(`[quality-signal] Error building signal for ${planData.plan_id}:`, error);
  }
}

/**
 * Submit a plan quality signal to Tuner (fire-and-forget).
 * Extracted for testability.
 */
async function submitPlanQualitySignal(
  client: ReturnType<typeof getDefaultTunerClient>,
  signal: PlanQualitySignal
): Promise<void> {
  const url = (client as any).url; // Access private field for this check
  if (!url) {
    console.log('[quality-signal] Tuner URL not configured, skipping submission');
    return;
  }

  try {
    const response = await fetch(`${url}/api/tuner/outcomes/plan-quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`[quality-signal] Signal submitted for plan ${signal.plan_id}`);
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    console.error('[quality-signal] Failed to submit signal:', error);
  }
}

/**
 * Gather metrics about the plan for the quality signal.
 */
function gatherPlanMetrics(db: Database.Database, planId: string): {
  questionCount: number;
  versionCount: number;
  improvementCount: number;
  blockCount: number;
} {
  // Count questions
  const questionsStmt = db.prepare(`
    SELECT COUNT(*) as count FROM questions WHERE plan_id = ?
  `);
  const questionsResult = questionsStmt.get(planId) as { count: number } | undefined;
  const questionCount = questionsResult?.count ?? 0;

  // Count versions
  const versionsStmt = db.prepare(`
    SELECT COUNT(*) as count FROM versions WHERE plan_id = ?
  `);
  const versionsResult = versionsStmt.get(planId) as { count: number } | undefined;
  const versionCount = versionsResult?.count ?? 1;

  // Count improvements
  const improvementsStmt = db.prepare(`
    SELECT COUNT(*) as count FROM improvements WHERE plan_id = ?
  `);
  const improvementsResult = improvementsStmt.get(planId) as { count: number } | undefined;
  const improvementCount = improvementsResult?.count ?? 0;

  // Get block count from plan's understanding (stored in the latest version)
  // Blocks come from ideation and are stored in understanding._blocks
  let blockCount = 0;
  const versionStmt = db.prepare(`
    SELECT understanding_json FROM versions
    WHERE plan_id = ?
    ORDER BY version DESC
    LIMIT 1
  `);
  const versionRow = versionStmt.get(planId) as { understanding_json?: string } | undefined;
  if (versionRow?.understanding_json) {
    try {
      const understanding = JSON.parse(versionRow.understanding_json);
      blockCount = understanding._blocks?.blocks?.length ?? 0;
    } catch {
      // Ignore parse errors
    }
  }

  return { questionCount, versionCount, improvementCount, blockCount };
}
