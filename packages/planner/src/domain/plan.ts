import { z } from 'zod';
import { PlanStatusSchema, PlanStatus } from './status.js';
import { SummarySchema, type Summary } from './summary.js';
import { StepSchema } from './step.js';
import { ApprovalInfoSchema } from './workflow.js';
import { DecompositionConfigSchema, type DecompositionConfig } from './decomposition-config.js';
import { ContextSchema, type Context } from './context.js';

/**
 * PlanSource tracks where a plan originated from.
 * - manual: Created directly via UI/API
 * - ideation: Created from an ideation session
 * - intake: Created from an intake signal
 */
export const PlanSourceSchema = z.object({
  type: z.enum(['manual', 'ideation', 'intake']),
  session_id: z.string().uuid().optional(),
  signal_id: z.string().uuid().optional(),
});

export type PlanSource = z.infer<typeof PlanSourceSchema>;

/**
 * Plan is a container for versions. It tracks the plan_id and timestamps.
 */
export const PlanSchema = z.object({
  plan_id: z.string().uuid(),
  org_id: z.string().uuid(),
  initiative_id: z.string().uuid().optional(),
  owner_user_id: z.string().optional(),
  source: PlanSourceSchema.optional(),
  /** Denormalized session ID extracted from source for efficient querying. Soft FK to ideation.db. */
  source_session_id: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(5).default(3),
  value_score: z.number().int().min(1).max(10).default(5),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Plan = z.infer<typeof PlanSchema>;

/**
 * Understanding schema - freeform specialist observations from ideation.
 * Each key is a specialist name, value is their freeform observations.
 */
export const UnderstandingSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

export type Understanding = z.infer<typeof UnderstandingSchema>;

/**
 * PlanVersion is a snapshot of a plan at a point in time.
 * Versions are immutable once approved.
 */
export const PlanVersionSchema = z.object({
  plan_id: z.string().uuid(),
  version: z.number().int().positive(),
  status: PlanStatusSchema,
  summary: SummarySchema,
  steps: z.array(StepSchema),
  understanding: UnderstandingSchema.optional(),
  context: ContextSchema.optional(),
  submitted_at: z.string().datetime().optional(),
  approval_info: ApprovalInfoSchema.optional(),
  change_request_id: z.string().uuid().optional(),
  /** DOT Framework: Decomposition limits and thresholds for this plan */
  decomposition_config: DecompositionConfigSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PlanVersion = z.infer<typeof PlanVersionSchema>;

/**
 * Creates a new Plan with generated UUID and timestamps.
 * source_session_id is automatically derived from source.session_id when not
 * explicitly provided, keeping the denormalized column in sync at creation time.
 */
export function createPlan(
  org_id: string,
  owner_user_id?: string,
  source?: PlanSource,
  source_session_id?: string
): Plan {
  const now = new Date().toISOString();
  const resolvedSource = source ?? { type: 'manual' };
  const plan: Plan = {
    plan_id: crypto.randomUUID(),
    org_id,
    owner_user_id,
    source: resolvedSource,
    source_session_id: source_session_id ?? resolvedSource.session_id,
    priority: 3,
    value_score: 5,
    created_at: now,
    updated_at: now,
  };
  return PlanSchema.parse(plan);
}

/**
 * Options for creating a PlanVersion
 */
export interface CreatePlanVersionOptions {
  context?: string;
  understanding?: Understanding;
  /** DOT Framework: Decomposition configuration */
  decomposition_config?: DecompositionConfig;
}

/**
 * Creates a new PlanVersion in draft status
 */
export function createPlanVersion(
  plan_id: string,
  goal: string,
  options?: CreatePlanVersionOptions
): PlanVersion {
  const now = new Date().toISOString();
  const summary: Summary = { goal };
  if (options?.context !== undefined) {
    summary.context = options.context;
  }

  const version: PlanVersion = {
    plan_id,
    version: 1,
    status: PlanStatus.Draft,
    summary,
    steps: [],
    understanding: options?.understanding,
    decomposition_config: options?.decomposition_config,
    created_at: now,
    updated_at: now,
  };
  return PlanVersionSchema.parse(version);
}
