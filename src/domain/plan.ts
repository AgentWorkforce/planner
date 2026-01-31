import { z } from 'zod';
import { PlanStatusSchema, PlanStatus } from './status.js';
import { SummarySchema, type Summary } from './summary.js';
import { StepSchema } from './step.js';
import { ApprovalInfoSchema } from './workflow.js';

/**
 * Plan is a container for versions. It tracks the plan_id and timestamps.
 */
export const PlanSchema = z.object({
  plan_id: z.string().uuid(),
  org_id: z.string().uuid(),
  initiative_id: z.string().uuid().optional(),
  owner_user_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Plan = z.infer<typeof PlanSchema>;

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
  submitted_at: z.string().datetime().optional(),
  approval_info: ApprovalInfoSchema.optional(),
  change_request_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PlanVersion = z.infer<typeof PlanVersionSchema>;

/**
 * Creates a new Plan with generated UUID and timestamps
 */
export function createPlan(org_id: string, owner_user_id?: string): Plan {
  const now = new Date().toISOString();
  const plan: Plan = {
    plan_id: crypto.randomUUID(),
    org_id,
    owner_user_id,
    created_at: now,
    updated_at: now,
  };
  return PlanSchema.parse(plan);
}

/**
 * Creates a new PlanVersion in draft status
 */
export function createPlanVersion(
  plan_id: string,
  goal: string,
  context?: string
): PlanVersion {
  const now = new Date().toISOString();
  const summary: Summary = { goal };
  if (context !== undefined) {
    summary.context = context;
  }

  const version: PlanVersion = {
    plan_id,
    version: 1,
    status: PlanStatus.Draft,
    summary,
    steps: [],
    created_at: now,
    updated_at: now,
  };
  return PlanVersionSchema.parse(version);
}
