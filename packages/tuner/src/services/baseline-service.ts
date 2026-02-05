/**
 * BaselineService
 *
 * Computes and maintains task baselines for drift detection.
 * Uses exponential moving average (EMA) for responsiveness and
 * Welford's algorithm for online variance computation.
 */

import type { TaskOutcome } from '../domain/outcome.js';
import type { TaskBaseline } from '../domain/baseline.js';
import type { TunerStorage } from '../storage/interface.js';

/**
 * Configuration for baseline computation.
 */
export interface BaselineConfig {
  /** Smoothing factor for EMA (default 0.1 = 10% weight to new value) */
  alpha: number;
}

const DEFAULT_CONFIG: BaselineConfig = {
  alpha: 0.1,
};

/**
 * BaselineService.
 * Computes and maintains task baselines using EMA and Welford's algorithm.
 */
export class BaselineService {
  private config: BaselineConfig;

  constructor(
    private storage: TunerStorage,
    config: Partial<BaselineConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update baseline from a new outcome.
   * Uses exponential moving average for mean and Welford's algorithm for stddev.
   */
  updateBaseline(outcome: TaskOutcome): TaskBaseline {
    const pattern = this.normalizePattern(outcome);
    const existing = this.storage.getTaskBaseline(pattern);

    if (!existing) {
      // First sample: initialize baseline
      const baseline = this.createInitialBaseline(pattern, outcome);
      this.storage.upsertTaskBaseline(baseline);
      return baseline;
    }

    // Update with EMA and Welford
    const updated = this.computeUpdatedBaseline(existing, outcome);
    this.storage.upsertTaskBaseline(updated);
    return updated;
  }

  /**
   * Get baseline for a pattern.
   * Returns null if no history exists.
   */
  getBaseline(pattern: string): TaskBaseline | null {
    return this.storage.getTaskBaseline(pattern);
  }

  /**
   * List all baselines.
   */
  listBaselines(): TaskBaseline[] {
    return this.storage.listTaskBaselines();
  }

  /**
   * Normalize a task outcome into a comparable pattern string.
   * Pattern = "{task_type}:{complexity}:{language_tier}"
   */
  normalizePattern(outcome: TaskOutcome): string {
    const taskType = this.inferTaskType(outcome);
    const complexity = outcome.complexity_estimate || 'moderate';
    const languageTier = outcome.language_tier || 'A';

    return `${taskType}:${complexity}:${languageTier}`;
  }

  /**
   * Create initial baseline from first sample.
   */
  private createInitialBaseline(pattern: string, outcome: TaskOutcome): TaskBaseline {
    const success = outcome.outcome === 'success';
    const verificationPassed = this.checkVerificationPassed(outcome);

    return {
      pattern,
      mean_duration_seconds: outcome.duration_seconds,
      stddev_duration_seconds: 0,
      mean_tokens: outcome.tokens_used,
      stddev_tokens: 0,
      mean_attempts: outcome.attempts,
      success_rate: success ? 1 : 0,
      verification_pass_rate: verificationPassed !== undefined ? (verificationPassed ? 1 : 0) : undefined,
      m2_duration: 0,
      m2_tokens: 0,
      sample_count: 1,
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Compute updated baseline using EMA for mean and Welford for stddev.
   */
  private computeUpdatedBaseline(existing: TaskBaseline, outcome: TaskOutcome): TaskBaseline {
    const alpha = this.config.alpha;
    const n = existing.sample_count + 1;
    const success = outcome.outcome === 'success';
    const verificationPassed = this.checkVerificationPassed(outcome);

    // EMA for means: new_mean = α * value + (1-α) * old_mean
    const newMeanDuration = alpha * outcome.duration_seconds + (1 - alpha) * existing.mean_duration_seconds;
    const newMeanTokens = alpha * outcome.tokens_used + (1 - alpha) * existing.mean_tokens;
    const newMeanAttempts = alpha * outcome.attempts + (1 - alpha) * existing.mean_attempts;

    // Welford's online algorithm for variance
    // M2 = M2 + (x - old_mean) * (x - new_mean)
    const m2Duration = (existing.m2_duration ?? 0) +
      (outcome.duration_seconds - existing.mean_duration_seconds) *
      (outcome.duration_seconds - newMeanDuration);

    const m2Tokens = (existing.m2_tokens ?? 0) +
      (outcome.tokens_used - existing.mean_tokens) *
      (outcome.tokens_used - newMeanTokens);

    // Stddev = sqrt(M2 / n) for population, sqrt(M2 / (n-1)) for sample
    // We use sample stddev (n-1) for better estimates with small n
    const stddevDuration = n > 1 ? Math.sqrt(m2Duration / (n - 1)) : 0;
    const stddevTokens = n > 1 ? Math.sqrt(m2Tokens / (n - 1)) : 0;

    // Success rate: simple running average
    const newSuccessRate = (existing.success_rate * existing.sample_count + (success ? 1 : 0)) / n;

    // Verification pass rate: only update if we have verification data
    let verificationPassRate = existing.verification_pass_rate;
    if (verificationPassed !== undefined && verificationPassRate !== undefined) {
      verificationPassRate = (verificationPassRate * existing.sample_count + (verificationPassed ? 1 : 0)) / n;
    } else if (verificationPassed !== undefined) {
      verificationPassRate = verificationPassed ? 1 : 0;
    }

    return {
      pattern: existing.pattern,
      mean_duration_seconds: newMeanDuration,
      stddev_duration_seconds: stddevDuration,
      mean_tokens: newMeanTokens,
      stddev_tokens: stddevTokens,
      mean_attempts: newMeanAttempts,
      success_rate: newSuccessRate,
      verification_pass_rate: verificationPassRate,
      m2_duration: m2Duration,
      m2_tokens: m2Tokens,
      sample_count: n,
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Check if all verifications passed for an outcome.
   */
  private checkVerificationPassed(outcome: TaskOutcome): boolean | undefined {
    if (!outcome.verification) return undefined;

    const v = outcome.verification;

    // If we have any verification data, check if all passed
    const hasData = v.tests_passed !== undefined ||
                    v.build_passed !== undefined ||
                    v.type_check_passed !== undefined ||
                    v.lint_passed !== undefined;

    if (!hasData) return undefined;

    // All defined checks must pass
    if (v.tests_passed === false) return false;
    if (v.build_passed === false) return false;
    if (v.type_check_passed === false) return false;
    if (v.lint_passed === false) return false;

    return true;
  }

  /**
   * Infer task type from outcome.
   */
  private inferTaskType(outcome: TaskOutcome): string {
    const stepId = outcome.step_id.toLowerCase();

    if (stepId.includes('doc') || stepId.includes('readme')) return 'documentation';
    if (stepId.includes('arch') || stepId.includes('design')) return 'architecture';
    if (stepId.includes('test')) return 'test';
    if (stepId.includes('review') || stepId.includes('audit')) return 'review';
    if (stepId.includes('refactor')) return 'refactor';

    return 'implementation';
  }
}
