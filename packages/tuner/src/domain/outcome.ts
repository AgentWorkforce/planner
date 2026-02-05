/**
 * Outcome types for Tuner.
 * These are the inputs that Forge emits after task/run completion.
 */

import { z } from 'zod';

// ============================================================================
// Verification Types (automated CI signals)
// ============================================================================

/**
 * Automated verification results from CI/build pipeline.
 * All signals are observable without human judgment.
 */
export const VerificationResultsSchema = z.object({
  tests_passed: z.boolean().optional(),
  tests_total: z.number().int().nonnegative().optional(),
  tests_failed_count: z.number().int().nonnegative().optional(),
  build_passed: z.boolean().optional(),
  type_check_passed: z.boolean().optional(),
  lint_passed: z.boolean().optional(),
});

export type VerificationResults = z.infer<typeof VerificationResultsSchema>;

/**
 * Aggregate verification summary for a run.
 */
export const VerificationSummarySchema = z.object({
  tests_passed_count: z.number().int().nonnegative(),
  tests_failed_count: z.number().int().nonnegative(),
  builds_passed_count: z.number().int().nonnegative(),
  builds_failed_count: z.number().int().nonnegative(),
  ac_met_count: z.number().int().nonnegative(),
  ac_total_count: z.number().int().nonnegative(),
});

export type VerificationSummary = z.infer<typeof VerificationSummarySchema>;

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Why a task failed (categorized for learning).
 */
export const ErrorCategorySchema = z.enum([
  'syntax_error',    // Code syntax issues
  'test_failure',    // Tests failed
  'type_error',      // Type checking failed
  'build_error',     // Build/compile failed
  'lint_error',      // Linter errors
  'timeout',         // Exceeded time limit
  'runtime_error',   // Error during execution
  'unknown',         // Uncategorized
]);

export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

// ============================================================================
// Acceptance Criteria Results
// ============================================================================

/**
 * Acceptance criteria verification result.
 * For automated AC checks (file exists, command passes, etc.)
 */
export const ACResultSchema = z.object({
  ac_id: z.string(),
  passed: z.boolean(),
  evidence: z.string().optional(),
});

export type ACResult = z.infer<typeof ACResultSchema>;

// ============================================================================
// Task Outcome
// ============================================================================

/**
 * Task execution outcome.
 * Forge emits this after each task completes.
 */
export const TaskOutcomeSchema = z.object({
  run_id: z.string(),
  task_id: z.string(),
  step_id: z.string(),

  // What was configured
  model_used: z.string(),
  complexity_estimate: z.string(),
  language_tier: z.string().optional(),

  // What happened
  outcome: z.enum(['success', 'failure', 'timeout', 'cancelled']),
  error_category: ErrorCategorySchema.optional(),
  attempts: z.number().int().positive(),
  duration_seconds: z.number().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),

  // Automated verification signals (from CI pipeline)
  verification: VerificationResultsSchema.optional(),

  // Acceptance criteria results (automated checks only)
  ac_results: z.array(ACResultSchema).optional(),

  // Quality signals
  confidence_score: z.number().min(0).max(1).optional(),

  // Metadata
  timestamp: z.string().datetime(),
});

export type TaskOutcome = z.infer<typeof TaskOutcomeSchema>;

// ============================================================================
// Run Outcome
// ============================================================================

/**
 * Run completion outcome.
 * Forge emits this after run completes.
 */
export const RunOutcomeSchema = z.object({
  run_id: z.string(),
  plan_id: z.string(),

  // Aggregate metrics
  outcome: z.enum(['completed', 'failed', 'cancelled']),
  tasks_total: z.number().int().nonnegative(),
  tasks_succeeded: z.number().int().nonnegative(),
  tasks_failed: z.number().int().nonnegative(),
  total_duration_seconds: z.number().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  total_cost_usd: z.number().nonnegative(),

  // Automated verification summary (aggregate across all tasks)
  verification_summary: VerificationSummarySchema.optional(),

  // Quality signals
  replan_count: z.number().int().nonnegative(),
  escalation_count: z.number().int().nonnegative(),

  timestamp: z.string().datetime(),
});

export type RunOutcome = z.infer<typeof RunOutcomeSchema>;
