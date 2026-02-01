import { z } from 'zod';

/**
 * Confidence level for agent observations during ideation.
 * - exploring: early stage, gathering information
 * - forming: patterns emerging, developing understanding
 * - confident: clear picture, ready to inform planning
 */
export const ConfidenceSchema = z.enum(['exploring', 'forming', 'confident']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * AgentObservations captures what a specialist agent noticed during ideation.
 * All fields are optional to allow incremental population.
 */
export const AgentObservationsSchema = z.object({
  observations: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  questions: z.array(z.string()).optional(),
  concerns: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  confidence: ConfidenceSchema.optional(),
  updated_at: z.string().datetime().optional(),
  updated_by: z.string().optional(),
});

export type AgentObservations = z.infer<typeof AgentObservationsSchema>;

/**
 * Understanding is a record of agent observations keyed by role.
 * Common roles: architect, designer, tester, security
 * But any string role is allowed for flexibility.
 */
export const UnderstandingSchema = z.record(z.string(), AgentObservationsSchema);

export type Understanding = z.infer<typeof UnderstandingSchema>;
