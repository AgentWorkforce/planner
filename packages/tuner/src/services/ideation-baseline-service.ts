/**
 * IdeationBaselineService
 *
 * Computes and maintains ideation baselines for learning.
 * Uses exponential moving average (EMA) for responsiveness and
 * Welford's algorithm for online variance computation.
 *
 * Updates baselines from PlanQualitySignal correlated with IdeationOutcome.
 */

import type { TunerStorage } from '../storage/interface.js';
import type { PlanQualitySignal } from '../domain/outcome.js';
import type { IdeationBaseline } from '../domain/baseline.js';
import { createIdeationBaseline } from '../domain/baseline.js';

/**
 * Smoothing factor for EMA (same as BaselineService).
 * alpha = 0.1 means 10% weight to new value, 90% to historical average.
 */
const EMA_ALPHA = 0.1;

/**
 * IdeationBaselineService.
 * Updates baselines when PlanQualitySignal is received, correlating with IdeationOutcome.
 */
export class IdeationBaselineService {
  constructor(private storage: TunerStorage) {}

  /**
   * Update baseline when a plan quality signal is received.
   * Correlates with the ideation outcome by session_id.
   */
  updateBaseline(signal: PlanQualitySignal): void {
    // Get the corresponding ideation outcome
    const outcomes = this.storage.getIdeationOutcomesBySession(signal.session_id);
    if (outcomes.length === 0) {
      console.warn(`[IdeationBaseline] No ideation outcome found for session ${signal.session_id}`);
      return;
    }

    const outcome = outcomes[0];
    if (!outcome) {
      console.warn(`[IdeationBaseline] Outcome is undefined for session ${signal.session_id}`);
      return;
    }

    // Get or create baseline (v1: single pattern 'session_quality')
    const pattern = 'session_quality';
    let baseline = this.storage.getIdeationBaseline(pattern);
    const isFirstSample = !baseline || baseline.sample_count === 0;

    if (!baseline) {
      baseline = createIdeationBaseline(pattern);
    }

    // Calculate metrics
    const blockUtilization = outcome.block_count > 0
      ? signal.block_count / outcome.block_count
      : 0;

    // Update baseline using Welford's algorithm for variance and EMA for means
    const n = baseline.sample_count + 1;

    // For first sample, set mean directly. For subsequent, use EMA
    if (isFirstSample) {
      baseline.mean_questions_per_plan = signal.question_count;
      baseline.mean_versions_per_plan = signal.version_count;
      baseline.mean_block_utilization = blockUtilization;
      baseline.mean_conversation_turns = outcome.conversation_turns;
      baseline.mean_time_to_approval_ms = signal.time_to_approval_ms;
    } else {
      // Update means with EMA
      baseline.mean_questions_per_plan = this.updateEma(baseline.mean_questions_per_plan, signal.question_count);
      baseline.mean_versions_per_plan = this.updateEma(baseline.mean_versions_per_plan, signal.version_count);
      baseline.mean_block_utilization = this.updateEma(baseline.mean_block_utilization, blockUtilization);
      baseline.mean_conversation_turns = this.updateEma(baseline.mean_conversation_turns, outcome.conversation_turns);
      baseline.mean_time_to_approval_ms = this.updateEma(baseline.mean_time_to_approval_ms, signal.time_to_approval_ms);
    }

    // Update Welford M2 for variance
    // Note: We use the new mean from EMA for Welford update
    baseline.m2_questions = this.updateM2(
      baseline.m2_questions,
      signal.question_count,
      baseline.mean_questions_per_plan,
      n
    );
    baseline.m2_versions = this.updateM2(
      baseline.m2_versions,
      signal.version_count,
      baseline.mean_versions_per_plan,
      n
    );
    baseline.m2_block_utilization = this.updateM2(
      baseline.m2_block_utilization,
      blockUtilization,
      baseline.mean_block_utilization,
      n
    );
    baseline.m2_conversation_turns = this.updateM2(
      baseline.m2_conversation_turns,
      outcome.conversation_turns,
      baseline.mean_conversation_turns,
      n
    );
    baseline.m2_time_to_approval = this.updateM2(
      baseline.m2_time_to_approval,
      signal.time_to_approval_ms,
      baseline.mean_time_to_approval_ms,
      n
    );

    // Update Thompson sampling (approval = success)
    const approved = outcome.outcome === 'approved';
    baseline.alpha = approved ? baseline.alpha + 1 : baseline.alpha;
    baseline.beta = approved ? baseline.beta : baseline.beta + 1;
    baseline.approval_rate = baseline.alpha / (baseline.alpha + baseline.beta);

    // Update sample count
    baseline.sample_count = n;
    baseline.last_updated = new Date().toISOString();

    // Save
    this.storage.upsertIdeationBaseline(baseline);
  }

  /**
   * Get the current baseline.
   */
  getBaseline(): IdeationBaseline | null {
    return this.storage.getIdeationBaseline('session_quality');
  }

  /**
   * List all baselines.
   */
  listBaselines(): IdeationBaseline[] {
    return this.storage.listIdeationBaselines();
  }

  /**
   * EMA update: new = alpha * value + (1 - alpha) * old
   */
  private updateEma(oldMean: number, value: number): number {
    return EMA_ALPHA * value + (1 - EMA_ALPHA) * oldMean;
  }

  /**
   * Welford M2 update for online variance.
   * M2_new = M2_old + (x - mean_new)^2
   * This is a simplified version since we're using EMA for the mean.
   */
  private updateM2(oldM2: number, value: number, newMean: number, n: number): number {
    if (n <= 1) return 0;
    const delta = value - newMean;
    return oldM2 + delta * delta;
  }

  /**
   * Get standard deviation from M2.
   * stddev = sqrt(M2 / (n - 1))
   */
  getStdDev(m2: number, sampleCount: number): number {
    if (sampleCount < 2) return 0;
    return Math.sqrt(m2 / (sampleCount - 1));
  }
}
