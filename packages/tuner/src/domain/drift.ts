/**
 * Drift detection types for Tuner.
 */

import { z } from 'zod';

// ============================================================================
// Drift Alert
// ============================================================================

/**
 * Type of drift detected.
 */
export const DriftTypeSchema = z.enum([
  'duration',      // Task taking longer/shorter than expected
  'tokens',        // Token usage deviating from baseline
  'success_rate',  // Success rate changing
  'attempts',      // Retry count changing
  'verification',  // Verification pass rate changing
]);

export type DriftType = z.infer<typeof DriftTypeSchema>;

/**
 * Severity of drift alert.
 */
export const DriftSeveritySchema = z.enum(['warning', 'critical']);

export type DriftSeverity = z.infer<typeof DriftSeveritySchema>;

/**
 * Drift alert generated when metrics deviate from baseline.
 */
export const DriftAlertSchema = z.object({
  id: z.string(),
  type: DriftTypeSchema,
  pattern: z.string(),

  // Current vs baseline values
  current_value: z.number(),
  baseline_value: z.number(),
  stddev: z.number().nonnegative(),

  // How many standard deviations from baseline
  deviation_sigmas: z.number(),

  // Alert severity (2σ = warning, 3σ = critical)
  severity: DriftSeveritySchema,

  // Acknowledgment tracking
  acknowledged: z.boolean(),
  acknowledged_by: z.string().optional(),
  acknowledged_at: z.string().datetime().optional(),

  // Metadata
  timestamp: z.string().datetime(),
});

export type DriftAlert = z.infer<typeof DriftAlertSchema>;

// ============================================================================
// Constants
// ============================================================================

/** Minimum samples before drift detection is active */
export const MIN_SAMPLES_FOR_DRIFT = 30;

/** Warning threshold in standard deviations */
export const WARNING_THRESHOLD_SIGMAS = 2;

/** Critical threshold in standard deviations */
export const CRITICAL_THRESHOLD_SIGMAS = 3;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a new drift alert.
 */
export function createDriftAlert(
  type: DriftType,
  pattern: string,
  currentValue: number,
  baselineValue: number,
  stddev: number
): DriftAlert {
  const deviationSigmas = stddev > 0
    ? (currentValue - baselineValue) / stddev
    : 0;

  const absDeviation = Math.abs(deviationSigmas);
  const severity: DriftSeverity = absDeviation >= CRITICAL_THRESHOLD_SIGMAS
    ? 'critical'
    : 'warning';

  return {
    id: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    pattern,
    current_value: currentValue,
    baseline_value: baselineValue,
    stddev,
    deviation_sigmas: deviationSigmas,
    severity,
    acknowledged: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if a deviation exceeds the warning threshold.
 */
export function isSignificantDeviation(deviationSigmas: number): boolean {
  return Math.abs(deviationSigmas) >= WARNING_THRESHOLD_SIGMAS;
}
