/**
 * StabilityControls Service
 *
 * Prevents parameter flapping with insufficient data using:
 * - Burn-in period (round-robin during initial exploration)
 * - Minimum samples per arm before exploitation
 * - Rate limiting (cool-down periods between changes)
 * - Hysteresis (minimum improvement margin before switching)
 * - Credible interval checks (95% CI width must be narrow enough)
 */

import type { StabilityConfig, StabilityCheckResult, StabilityCheckContext } from '../domain/stability.js';
import { DEFAULT_STABILITY_CONFIG } from '../domain/stability.js';
import type { TunerStorage } from '../storage/interface.js';

/**
 * StabilityControls service.
 * All checks are logged for debugging.
 */
export class StabilityControls {
  private config: StabilityConfig;
  private lastChangeTimes: Map<string, Date> = new Map();

  constructor(
    private storage: TunerStorage,
    config: Partial<StabilityConfig> = {}
  ) {
    this.config = { ...DEFAULT_STABILITY_CONFIG, ...config };
  }

  /**
   * Get current config.
   */
  getConfig(): StabilityConfig {
    return this.config;
  }

  /**
   * Update config.
   */
  updateConfig(config: Partial<StabilityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Run all stability checks.
   * Returns whether a change is allowed and reasons if blocked.
   */
  checkStability(context: StabilityCheckContext): StabilityCheckResult {
    const blockedBy: string[] = [];

    // Check burn-in
    if (this.checkBurnIn(context.totalTrials)) {
      blockedBy.push(`burn_in: ${context.totalTrials}/${this.config.burn_in_trials} trials`);
    }

    // Check minimum samples
    if (this.checkMinSamples(context.currentArmSamples)) {
      blockedBy.push(`min_samples: ${context.currentArmSamples}/${this.config.min_samples_per_arm} samples`);
    }

    // Check rate limit
    if (context.lastChangedAt && this.checkRateLimit(context.parameterType, context.lastChangedAt)) {
      const coolDown = this.getCoolDownPeriod(context.parameterType);
      const elapsed = Date.now() - context.lastChangedAt.getTime();
      const remaining = Math.ceil((coolDown - elapsed) / 60000);
      blockedBy.push(`rate_limit: ${remaining} min remaining`);
    }

    // Check hysteresis
    if (context.currentProbability !== undefined &&
        context.candidateProbability !== undefined &&
        this.checkHysteresis(context.currentProbability, context.candidateProbability)) {
      const improvement = ((context.candidateProbability - context.currentProbability) /
                          context.currentProbability * 100).toFixed(1);
      blockedBy.push(`hysteresis: ${improvement}% < ${this.config.improvement_margin * 100}% required`);
    }

    // Check credible interval width
    if (context.alpha !== undefined && context.beta !== undefined) {
      const ciWidth = this.computeCredibleIntervalWidth(context.alpha, context.beta);
      if (this.checkCredibleInterval(context.alpha, context.beta)) {
        blockedBy.push(`ci_width: ${(ciWidth * 100).toFixed(1)}% > ${this.config.max_ci_width * 100}% max`);
      }
    }

    const canChange = blockedBy.length === 0;

    // Log decision
    this.logStabilityDecision(context, canChange, blockedBy);

    return {
      canChange,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    };
  }

  /**
   * Check if still in burn-in period.
   * @returns true if blocked (still in burn-in)
   */
  checkBurnIn(totalTrials: number): boolean {
    return totalTrials < this.config.burn_in_trials;
  }

  /**
   * Check if arm has minimum samples.
   * @returns true if blocked (not enough samples)
   */
  checkMinSamples(armSamples: number): boolean {
    return armSamples < this.config.min_samples_per_arm;
  }

  /**
   * Check if still within cool-down period.
   * @returns true if blocked (within cool-down)
   */
  checkRateLimit(parameterType: StabilityCheckContext['parameterType'], lastChangedAt: Date): boolean {
    const coolDown = this.getCoolDownPeriod(parameterType);
    const elapsed = Date.now() - lastChangedAt.getTime();
    return elapsed < coolDown;
  }

  /**
   * Check if improvement is below hysteresis margin.
   * @returns true if blocked (improvement too small)
   */
  checkHysteresis(currentProbability: number, candidateProbability: number): boolean {
    if (currentProbability === 0) return false; // Allow change from zero

    const improvement = (candidateProbability - currentProbability) / currentProbability;
    return improvement < this.config.improvement_margin;
  }

  /**
   * Check if credible interval is too wide.
   * @returns true if blocked (CI too wide)
   */
  checkCredibleInterval(alpha: number, beta: number): boolean {
    const width = this.computeCredibleIntervalWidth(alpha, beta);
    return width > this.config.max_ci_width;
  }

  /**
   * Compute 95% credible interval width for Beta distribution.
   * Uses normal approximation for large sample sizes.
   */
  computeCredibleIntervalWidth(alpha: number, beta: number): number {
    // For Beta(α, β), mean = α/(α+β) and variance = αβ/((α+β)²(α+β+1))
    const n = alpha + beta;
    const variance = (alpha * beta) / (n * n * (n + 1));
    const stddev = Math.sqrt(variance);

    // 95% CI width ≈ 4 * stddev (±2σ covers ~95%)
    return 4 * stddev;
  }

  /**
   * Record that a parameter change was made.
   */
  recordChange(parameterType: StabilityCheckContext['parameterType']): void {
    this.lastChangeTimes.set(parameterType, new Date());
  }

  /**
   * Get last change time for a parameter type.
   */
  getLastChangeTime(parameterType: StabilityCheckContext['parameterType']): Date | undefined {
    return this.lastChangeTimes.get(parameterType);
  }

  /**
   * Get cool-down period for a parameter type.
   */
  private getCoolDownPeriod(parameterType: StabilityCheckContext['parameterType']): number {
    switch (parameterType) {
      case 'model_selection':
        return this.config.cool_down_periods.model_selection_ms;
      case 'budget':
        return this.config.cool_down_periods.budget_ms;
      case 'retry':
        return this.config.cool_down_periods.retry_ms;
      default:
        return this.config.cool_down_periods.model_selection_ms;
    }
  }

  /**
   * Log stability decision for debugging.
   */
  private logStabilityDecision(
    context: StabilityCheckContext,
    canChange: boolean,
    blockedBy: string[]
  ): void {
    const decision = canChange ? 'ALLOWED' : 'BLOCKED';
    const reasons = blockedBy.length > 0 ? ` (${blockedBy.join(', ')})` : '';
    console.log(`[StabilityControls] ${context.parameterType} change ${decision}${reasons}`);
  }
}
