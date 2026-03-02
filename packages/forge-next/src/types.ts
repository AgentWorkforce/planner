/**
 * forge-next domain types.
 *
 * Zod schemas are the source of truth. TypeScript types are inferred from them.
 * Keep this lean — this layer intentionally avoids the complexity of forge-core.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Run status
// ---------------------------------------------------------------------------

export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

// ---------------------------------------------------------------------------
// Step override — per-step configuration supplied by the caller
// ---------------------------------------------------------------------------

export const StepOverrideSchema = z.object({
  step_id: z.string(),
  model: z.enum(['haiku', 'sonnet', 'opus']).optional(),
  skip: z.boolean().optional(),
});

export type StepOverride = z.infer<typeof StepOverrideSchema>;

// ---------------------------------------------------------------------------
// ForgeConfig — user-provided execution configuration for a run
// ---------------------------------------------------------------------------

export const ExecutionPolicySchema = z.object({
  max_concurrent_tasks: z.number().int().positive().optional(),
  max_timeout_ms: z.number().int().positive().optional(),
  retry_count: z.number().int().min(0).optional(),
});

export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

export const ForgeConfigSchema = z.object({
  workspace_path: z.string().optional(),
  step_overrides: z.array(StepOverrideSchema).default([]),
  execution_policy: ExecutionPolicySchema.optional(),
});

export type ForgeConfig = z.infer<typeof ForgeConfigSchema>;

// ---------------------------------------------------------------------------
// ForgeNextRun — our wrapper around a relay workflow run
// ---------------------------------------------------------------------------

export const ForgeNextRunSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  plan_version: z.number().int().positive(),
  /** relay WorkflowRunRow.id — null until the relay runner is started */
  relay_run_id: z.string().nullable(),
  status: RunStatusSchema,
  /** JSON-serialised ForgeConfig */
  config: z.string(),
  /** JSON-serialised RelayYamlConfig produced by the compiler — null until compiled */
  workflow_config: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ForgeNextRun = z.infer<typeof ForgeNextRunSchema>;

// ---------------------------------------------------------------------------
// Gate — human approval checkpoint tied to a plan step
// ---------------------------------------------------------------------------

export const GateStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export type GateStatus = z.infer<typeof GateStatusSchema>;

export const GateSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string(),
  step_name: z.string(),
  status: GateStatusSchema,
  approver: z.string().nullable(),
  decision_note: z.string().nullable(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
});

export type Gate = z.infer<typeof GateSchema>;

// ---------------------------------------------------------------------------
// Question — agent request for clarification from a human
// ---------------------------------------------------------------------------

export const QuestionStatusSchema = z.enum(['pending', 'answered', 'dismissed']);

export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string(),
  agent_id: z.string().nullable(),
  question: z.string(),
  answer: z.string().nullable(),
  status: QuestionStatusSchema,
  created_at: z.string(),
  answered_at: z.string().nullable(),
});

export type Question = z.infer<typeof QuestionSchema>;

// ---------------------------------------------------------------------------
// ForgeNextEvent — append-only event log entry
// ---------------------------------------------------------------------------

export const ForgeNextEventSchema = z.object({
  /** Auto-incremented integer assigned by the database */
  id: z.number().int(),
  run_id: z.string(),
  event_type: z.string(),
  /** JSON-serialised event payload */
  payload: z.string(),
  created_at: z.string(),
});

export type ForgeNextEvent = z.infer<typeof ForgeNextEventSchema>;
