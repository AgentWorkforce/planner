/**
 * ReconciliationLoop — periodic health checks during active runs.
 *
 * Checks every 30s while a run is active:
 * 1. Is the plan still published? → abort if retracted
 * 2. Has the plan version drifted? → warn if newer version exists
 * 3. Is the run stalled? → escalate if no step progress for 5+ minutes
 *
 * Upstream dependency failure → proactive skip is already handled by the
 * relay SDK's DAG execution engine, so we don't duplicate that here.
 */

import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal plan reader — decoupled from planner storage. */
export interface PlanReader {
  getPlanStatus(planId: string): Promise<{ status: string; latestVersion: number } | null>;
}

/** Minimal run state accessor — decoupled from forge-next internals. */
export interface RunStateAccessor {
  getActiveRun(): {
    planId: string;
    planVersion: number;
    runId: string;
    lastStepProgressAt: number;
  } | null;
  abortRun(reason: string): void;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface ReconciliationPlanRetractedPayload {
  run_id: string;
  plan_id: string;
  reason: string;
}

export interface ReconciliationStallDetectedPayload {
  run_id: string;
  elapsed_ms: number;
}

export interface ReconciliationVersionDriftPayload {
  run_id: string;
  plan_id: string;
  current_version: number;
  latest_version: number;
}

interface ReconciliationEvents {
  'reconciliation:plan-retracted': [payload: ReconciliationPlanRetractedPayload];
  'reconciliation:stall-detected': [payload: ReconciliationStallDetectedPayload];
  'reconciliation:version-drift': [payload: ReconciliationVersionDriftPayload];
}

// ---------------------------------------------------------------------------
// ReconciliationLoop
// ---------------------------------------------------------------------------

/** Stall threshold: no step progress for 5 minutes. */
const STALL_THRESHOLD_MS = 5 * 60_000;

export class ReconciliationLoop extends EventEmitter<ReconciliationEvents> {
  private interval: ReturnType<typeof setInterval> | null = null;
  /** Track whether we've already warned about version drift for this run. */
  private driftWarned = false;
  /** Track whether we've already warned about a stall for this run. */
  private stallWarned = false;

  constructor(
    private readonly planReader: PlanReader,
    private readonly runState: RunStateAccessor,
    private readonly intervalMs = 30_000,
  ) {
    super();
  }

  start(): void {
    this.stop();
    this.driftWarned = false;
    this.stallWarned = false;
    this.interval = setInterval(() => this.tick().catch(console.error), this.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.driftWarned = false;
    this.stallWarned = false;
  }

  private async tick(): Promise<void> {
    const run = this.runState.getActiveRun();
    if (!run) return;

    // 1. Check plan status
    const planInfo = await this.planReader.getPlanStatus(run.planId);
    if (!planInfo) {
      // Plan deleted entirely
      this.emit('reconciliation:plan-retracted', {
        run_id: run.runId,
        plan_id: run.planId,
        reason: 'Plan no longer exists',
      });
      this.runState.abortRun('Plan no longer exists');
      this.stop();
      return;
    }

    if (planInfo.status !== 'published') {
      this.emit('reconciliation:plan-retracted', {
        run_id: run.runId,
        plan_id: run.planId,
        reason: `Plan status changed to '${planInfo.status}'`,
      });
      this.runState.abortRun(`Plan retracted (status: ${planInfo.status})`);
      this.stop();
      return;
    }

    // 2. Check version drift
    if (planInfo.latestVersion > run.planVersion && !this.driftWarned) {
      this.driftWarned = true;
      this.emit('reconciliation:version-drift', {
        run_id: run.runId,
        plan_id: run.planId,
        current_version: run.planVersion,
        latest_version: planInfo.latestVersion,
      });
    }

    // 3. Check for run stall (emit once per stall)
    const elapsed = Date.now() - run.lastStepProgressAt;
    if (elapsed >= STALL_THRESHOLD_MS && !this.stallWarned) {
      this.stallWarned = true;
      this.emit('reconciliation:stall-detected', {
        run_id: run.runId,
        elapsed_ms: elapsed,
      });
    }
  }
}
