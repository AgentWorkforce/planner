import { z } from 'zod';

/**
 * AcceptanceCriterion defines what must be true for a step to be complete.
 * - id: unique identifier within the step
 * - description: what must be verified
 * - type: optional category (e.g., 'test', 'review', 'metric')
 */
export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1, 'Criterion id is required'),
  description: z.string(), // Allow empty during editing; validate non-empty at approval
  type: z.string().optional(),
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
