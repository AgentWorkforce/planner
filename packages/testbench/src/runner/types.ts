import { z } from 'zod';

// ============================================
// Verification Result (re-exported for convenience)
// ============================================

export const VerificationResultSchema = z.object({
  passed: z.boolean(),
  details: z.string(),
  duration_ms: z.number().nonnegative().optional(),
});

// ============================================
// Ideation Metrics
// ============================================

export const IdeationMetricsSchema = z.object({
  session_id: z.string(),
  specialist_count: z.number().nonnegative(),
  understanding_keys: z.array(z.string()),
  block_count: z.number().nonnegative(),
  curated_block_count: z.number().nonnegative(),
  ideation_time_ms: z.number().nonnegative(),
  handoff_plan_id: z.string(),
  handoff_plan_version: z.number(),
  ideation_strategy: z.enum(['preconfigured', 'ai']),
});

export type IdeationMetrics = z.infer<typeof IdeationMetricsSchema>;

// ============================================
// Run Result
// ============================================

export const RunResultSchema = z.object({
  scenario_id: z.string(),
  run_id: z.string(),
  success: z.boolean(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),

  // Plan metrics
  plan_id: z.string().optional(),
  plan_version: z.number().optional(),
  plan_step_count: z.number().nonnegative().optional(),
  estimated_complexity: z.number().nonnegative().optional(),
  estimated_time_minutes: z.number().nonnegative().optional(),

  // Execution metrics
  actual_time_seconds: z.number().nonnegative(),
  setup_time_seconds: z.number().nonnegative().optional(),
  execution_time_seconds: z.number().nonnegative().optional(),
  actual_tokens: z.number().nonnegative().optional(),
  actual_cost_usd: z.number().nonnegative().optional(),

  // Ideation metrics
  ideation_metrics: IdeationMetricsSchema.optional(),

  // Verification
  verification_result: VerificationResultSchema.optional(),

  // Error (if failed)
  error: z.string().optional(),

  // Mode
  mock: z.boolean().default(false),
});

export type RunResult = z.infer<typeof RunResultSchema>;

// ============================================
// Run Options
// ============================================

export interface RunOptions {
  mock?: boolean;
  timeout_minutes?: number;
  workspace_path?: string;
  verbose?: boolean;
}
