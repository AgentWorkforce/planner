import { z } from 'zod';
import { StepSchema } from './step.js';

/**
 * Status of a change request.
 */
export const ChangeRequestStatusSchema = z.enum(['pending', 'applied', 'rejected']);
export type ChangeRequestStatus = z.infer<typeof ChangeRequestStatusSchema>;

/**
 * Step modification within a change request.
 * Contains the step_id and partial step data to update.
 */
export const StepModificationSchema = z.object({
  step_id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  scope: z.string().optional(),
  owner_role: z.string().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
});

export type StepModification = z.infer<typeof StepModificationSchema>;

/**
 * Suggested changes to apply to a plan.
 */
export const SuggestedChangesSchema = z.object({
  add_steps: z.array(StepSchema).optional(),
  modify_steps: z.array(StepModificationSchema).optional(),
  remove_steps: z.array(z.string().uuid()).optional(),
});

export type SuggestedChanges = z.infer<typeof SuggestedChangesSchema>;

/**
 * A change request from the Orchestrator.
 * When the Orchestrator discovers a plan is inadequate, it submits a change request
 * which triggers creation of a new draft version.
 */
export const ChangeRequestSchema = z.object({
  change_request_id: z.string().uuid(),
  run_id: z.string(),
  plan_id: z.string().uuid(),
  reason: z.string().min(1),
  suggested_changes: SuggestedChangesSchema,
  status: ChangeRequestStatusSchema,
  result_version: z.number().int().positive().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;

/**
 * Creates a new ChangeRequest in pending status.
 */
export function createChangeRequest(
  runId: string,
  planId: string,
  reason: string,
  suggestedChanges: SuggestedChanges
): ChangeRequest {
  const now = new Date().toISOString();
  const changeRequest: ChangeRequest = {
    change_request_id: crypto.randomUUID(),
    run_id: runId,
    plan_id: planId,
    reason,
    suggested_changes: suggestedChanges,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
  return ChangeRequestSchema.parse(changeRequest);
}
