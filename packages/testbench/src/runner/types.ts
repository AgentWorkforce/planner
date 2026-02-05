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
  actual_tokens: z.number().nonnegative().optional(),
  actual_cost_usd: z.number().nonnegative().optional(),

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
