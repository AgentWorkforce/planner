import { z } from 'zod';

/**
 * Summary captures the intent of a plan version
 * - goal: required, what the plan aims to achieve
 * - context: optional, background or constraints
 */
export const SummarySchema = z.object({
  goal: z.string().min(1, 'Goal is required'),
  context: z.string().optional(),
});

export type Summary = z.infer<typeof SummarySchema>;
