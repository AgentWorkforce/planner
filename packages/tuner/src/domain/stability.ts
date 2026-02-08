/**
 * Stability control types for Tuner.
 * Prevents parameter flapping with insufficient data.
 */

import { z } from 'zod';

// ============================================================================
// Stability Config
// ============================================================================

/**
 * Configuration for stability controls.
 */
export const StabilityConfigSchema = z.object({
  /** Total trials before Thompson sampling exploitation (use round-robin during burn-in) */
  burn_in_trials: z.number().int().positive(),

  /** Minimum samples per arm before exploitation */
  min_samples_per_arm: z.number().int().positive(),

  /** Cool-down periods for different parameter types (in milliseconds) */
  cool_down_periods: z.object({
    model_selection_ms: z.number().int().nonnegative(),
    budget_ms: z.number().int().nonnegative(),
    retry_ms: z.number().int().nonnegative(),
  }),

  /** Minimum improvement margin before switching (e.g., 0.15 = 15%) */
  improvement_margin: z.number().min(0).max(1),

  /** Maximum credible interval width before acting (e.g., 0.10) */
  max_ci_width: z.number().min(0).max(1),
});

export type StabilityConfig = z.infer<typeof StabilityConfigSchema>;

// ============================================================================
// Stability Check Result
// ============================================================================

/**
 * Result of a stability check.
 */
export const StabilityCheckResultSchema = z.object({
  canChange: z.boolean(),
  blockedBy: z.array(z.string()).optional(),
});

export type StabilityCheckResult = z.infer<typeof StabilityCheckResultSchema>;

// ============================================================================
// Default Configuration (research-backed)
// ============================================================================

export const DEFAULT_STABILITY_CONFIG: StabilityConfig = {
  burn_in_trials: 50,
  min_samples_per_arm: 30,
  cool_down_periods: {
    model_selection_ms: 24 * 60 * 60 * 1000, // 24 hours
    budget_ms: 4 * 60 * 60 * 1000,           // 4 hours
    retry_ms: 1 * 60 * 60 * 1000,            // 1 hour
  },
  improvement_margin: 0.15, // 15%
  max_ci_width: 0.10,
};

// ============================================================================
// Context for Stability Checks
// ============================================================================

/**
 * Context for running stability checks.
 */
export interface StabilityCheckContext {
  /** Total trials so far */
  totalTrials: number;

  /** Samples for the current arm */
  currentArmSamples: number;

  /** Timestamp of last parameter change */
  lastChangedAt?: Date;

  /** Parameter type being changed */
  parameterType: 'model_selection' | 'budget' | 'retry' | 'ideation_model' | 'ideation_confidence' | 'ideation_spawning' | 'ideation_readiness';

  /** Current probability (for hysteresis check) */
  currentProbability?: number;

  /** Candidate probability (for hysteresis check) */
  candidateProbability?: number;

  /** Alpha and beta for CI width check */
  alpha?: number;
  beta?: number;
}
