/**
 * Baseline types for Tuner.
 * Used for drift detection and Thompson sampling.
 */

import { z } from 'zod';

// ============================================================================
// Task Baseline
// ============================================================================

/**
 * Baseline for a task pattern.
 * Used for drift detection.
 */
export const TaskBaselineSchema = z.object({
  pattern: z.string(),

  // Historical metrics (duration)
  mean_duration_seconds: z.number().nonnegative(),
  stddev_duration_seconds: z.number().nonnegative(),

  // Historical metrics (tokens)
  mean_tokens: z.number().nonnegative(),
  stddev_tokens: z.number().nonnegative(),

  // Historical metrics (attempts)
  mean_attempts: z.number().nonnegative(),

  // Success metrics
  success_rate: z.number().min(0).max(1),

  // Verification pass rate (tasks with all verifications passing)
  verification_pass_rate: z.number().min(0).max(1).optional(),

  // Welford's algorithm state for online variance
  // M2 = sum of squares of differences from the current mean
  m2_duration: z.number().nonnegative().optional(),
  m2_tokens: z.number().nonnegative().optional(),

  // Sample size
  sample_count: z.number().int().positive(),
  last_updated: z.string().datetime(),
});

export type TaskBaseline = z.infer<typeof TaskBaselineSchema>;

// ============================================================================
// Model Baseline
// ============================================================================

/**
 * Model performance baseline.
 * Used for Thompson sampling.
 */
export const ModelBaselineSchema = z.object({
  model: z.string(),
  task_type: z.string(),
  complexity: z.string(),

  // Beta distribution parameters (Thompson sampling)
  // alpha = successes + 1 (prior)
  // beta = failures + 1 (prior)
  alpha: z.number().positive(),
  beta: z.number().positive(),

  // Aggregate metrics
  total_attempts: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
  mean_cost_per_success: z.number().nonnegative(),

  last_updated: z.string().datetime(),
});

export type ModelBaseline = z.infer<typeof ModelBaselineSchema>;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a new task baseline from the first sample.
 */
export function createTaskBaseline(
  pattern: string,
  durationSeconds: number,
  tokensUsed: number,
  attempts: number,
  success: boolean,
  verificationPassed?: boolean
): TaskBaseline {
  return {
    pattern,
    mean_duration_seconds: durationSeconds,
    stddev_duration_seconds: 0,
    mean_tokens: tokensUsed,
    stddev_tokens: 0,
    mean_attempts: attempts,
    success_rate: success ? 1 : 0,
    verification_pass_rate: verificationPassed !== undefined ? (verificationPassed ? 1 : 0) : undefined,
    m2_duration: 0,
    m2_tokens: 0,
    sample_count: 1,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Create a new model baseline with uninformative Beta(1,1) prior.
 */
export function createModelBaseline(
  model: string,
  taskType: string,
  complexity: string,
  success: boolean,
  costUsd: number
): ModelBaseline {
  return {
    model,
    task_type: taskType,
    complexity,
    alpha: success ? 2 : 1, // Start with 1, add 1 for success
    beta: success ? 1 : 2,  // Start with 1, add 1 for failure
    total_attempts: 1,
    success_rate: success ? 1 : 0,
    mean_cost_per_success: success ? costUsd : 0,
    last_updated: new Date().toISOString(),
  };
}
