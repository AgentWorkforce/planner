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

// ---------------------------------------------------------------------------
// StepBaton — structured handoff between execution phases
// ---------------------------------------------------------------------------

export const StepBatonSchema = z.object({
  run_id: z.string(),
  phase_id: z.string(),
  completed_steps: z.array(z.object({
    step_id: z.string(),
    title: z.string(),
    summary: z.string().max(200),
  })),
  artifacts: z.array(z.object({
    path: z.string(),
    description: z.string().max(100),
  })).max(20),
  gotchas: z.array(z.string().max(150)).max(5),
  decisions: z.array(z.object({
    what: z.string().max(150),
    why: z.string().max(150),
  })).max(5),
  state: z.string().max(300),
  git_ref: z.string().optional(),
});

export type StepBaton = z.infer<typeof StepBatonSchema>;

/** Compiled representation of a phase boundary within a workflow run. */
export interface CompiledPhase {
  phase_id: string;
  step_ids: string[];
  boundary_reason?: 'scope_change' | 'gate' | 'role_change' | 'step_count_cap';
  /** The phase_id that must produce a baton before this phase can start. */
  requires_baton_from?: string;
  produces_baton: boolean;
}

// ---------------------------------------------------------------------------
// Run monitoring event payloads
// ---------------------------------------------------------------------------

export const StepMetricsEventSchema = z.object({
  type: z.literal('step:metrics'),
  run_id: z.string(),
  step_name: z.string(),
  model: z.string(),
  duration_ms: z.number(),
  estimated_cost_usd: z.number(),
});

export type StepMetricsEvent = z.infer<typeof StepMetricsEventSchema>;

export const RunMetricsEventSchema = z.object({
  type: z.literal('run:metrics'),
  run_id: z.string(),
  total_cost_usd: z.number(),
  steps_completed: z.number().int(),
  steps_total: z.number().int(),
  avg_satisfaction: z.number().min(0).max(100),
});

export type RunMetricsEvent = z.infer<typeof RunMetricsEventSchema>;

export const StallWarningEventSchema = z.object({
  type: z.literal('stall:warning'),
  run_id: z.string(),
  step_name: z.string(),
  elapsed_ms: z.number(),
  threshold_ms: z.number(),
});

export type StallWarningEvent = z.infer<typeof StallWarningEventSchema>;

export const StepRetryContextEventSchema = z.object({
  type: z.literal('step:retry-context'),
  run_id: z.string(),
  step_name: z.string(),
  attempt: z.number().int(),
  previous_failures: z.array(z.string()),
  total_failure_count: z.number().int(),
});

export type StepRetryContextEvent = z.infer<typeof StepRetryContextEventSchema>;

export const StepFailedEnrichedEventSchema = z.object({
  type: z.literal('step:failed-enriched'),
  run_id: z.string(),
  step_name: z.string(),
  error: z.string(),
  failures: z.array(z.string()),
  attempt: z.number().int(),
});

export type StepFailedEnrichedEvent = z.infer<typeof StepFailedEnrichedEventSchema>;

export const StepScoredEventSchema = z.object({
  type: z.literal('step:scored'),
  run_id: z.string(),
  step_name: z.string(),
  score: z.number().min(0).max(100),
  reasoning: z.string(),
  matched_criteria: z.array(z.string()),
  failed_criteria: z.array(z.string()),
});

export type StepScoredEvent = z.infer<typeof StepScoredEventSchema>;

// ---------------------------------------------------------------------------
// Reconciliation event payloads
// ---------------------------------------------------------------------------

export const ReconciliationPlanRetractedEventSchema = z.object({
  type: z.literal('reconciliation:plan-retracted'),
  run_id: z.string(),
  plan_id: z.string(),
  reason: z.string(),
});

export type ReconciliationPlanRetractedEvent = z.infer<typeof ReconciliationPlanRetractedEventSchema>;

export const ReconciliationStallDetectedEventSchema = z.object({
  type: z.literal('reconciliation:stall-detected'),
  run_id: z.string(),
  elapsed_ms: z.number(),
});

export type ReconciliationStallDetectedEvent = z.infer<typeof ReconciliationStallDetectedEventSchema>;

export const ReconciliationVersionDriftEventSchema = z.object({
  type: z.literal('reconciliation:version-drift'),
  run_id: z.string(),
  plan_id: z.string(),
  current_version: z.number().int(),
  latest_version: z.number().int(),
});

export type ReconciliationVersionDriftEvent = z.infer<typeof ReconciliationVersionDriftEventSchema>;

// ---------------------------------------------------------------------------
// Topic injection (knowledge flywheel)
// ---------------------------------------------------------------------------

/** Summary of a mull topic file relevant to a step. */
export interface TopicSummary {
  slug: string;
  /** L1 overview — purpose-written summary for context injection. Falls back to body excerpt. */
  content: string;
}

/** Retrieval trace entry for a single candidate topic. */
export interface TopicRetrievalCandidate {
  slug: string;
  keyword_score: number;
  hotness_score: number;
  combined_score: number;
  selected: boolean;
  reason: 'selected' | 'below_threshold' | 'budget_exceeded';
}

/** Full retrieval trace for observability and debugging. */
export interface TopicRetrievalTrace {
  query_keywords: string[];
  candidates_considered: number;
  results: TopicRetrievalCandidate[];
}

/** Result from TopicProvider including optional retrieval trace. */
export interface TopicRetrievalResult {
  topics: TopicSummary[];
  trace?: TopicRetrievalTrace;
}

/**
 * Provider for mull topic files. Implemented by the server layer
 * to bridge forge-next and mull's knowledge store.
 */
export interface TopicProvider {
  /** Find topic files relevant to the given keywords. */
  findRelevant(keywords: string[], maxTopics?: number): Promise<TopicRetrievalResult>;
}
