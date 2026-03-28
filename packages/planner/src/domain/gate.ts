import { z } from 'zod';

/**
 * Gate defines a human approval checkpoint in the plan.
 * - type: currently only 'human_approval' supported
 * - approver_role: optional role that can approve (e.g., 'tech_lead')
 */
export const GateSchema = z.object({
  type: z.literal('human_approval'),
  approver_role: z.string().optional(),
});

export type Gate = z.infer<typeof GateSchema>;
