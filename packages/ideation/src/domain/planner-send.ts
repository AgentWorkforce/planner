/**
 * Ideation Domain - PlannerSend Schema
 *
 * Captures the exact payload sent to planner and the result.
 * planner_sends[] is append-only history of all sends.
 */

import { z } from 'zod';
import { UnderstandingSchema } from './understanding.js';

// =============================================================================
// PlannerSend Schemas
// =============================================================================

/**
 * Source information for plans created from ideation.
 */
export const PlannerSendSourceSchema = z.object({
  type: z.literal('ideation'),
  session_id: z.string(),
});

export type PlannerSendSource = z.infer<typeof PlannerSendSourceSchema>;

/**
 * The payload sent to planner when creating/updating a plan.
 */
export const PlannerSendPayloadSchema = z.object({
  /** The goal for the plan (from initial_intent or override) */
  goal: z.string(),
  /** Optional context/background */
  context: z.string().optional(),
  /** Source tracking for the plan */
  source: PlannerSendSourceSchema,
  /** Freeform understanding from specialists */
  understanding: UnderstandingSchema,
  /** Optional initiative association */
  initiative_id: z.string().optional(),
});

export type PlannerSendPayload = z.infer<typeof PlannerSendPayloadSchema>;

/**
 * The result returned from planner after creating/updating.
 */
export const PlannerSendResultSchema = z.object({
  /** The plan ID (created or updated) */
  plan_id: z.string(),
  /** The version number of the plan */
  plan_version: z.number(),
});

export type PlannerSendResult = z.infer<typeof PlannerSendResultSchema>;

/**
 * A complete record of a send-to-planner operation.
 * Captures both the exact payload and the result for audit trail.
 */
export const PlannerSendSchema = z.object({
  /** When this send occurred (ISO 8601) */
  sent_at: z.string(),
  /** The exact payload sent to planner */
  payload: PlannerSendPayloadSchema,
  /** The result from planner */
  result: PlannerSendResultSchema,
});

export type PlannerSend = z.infer<typeof PlannerSendSchema>;

/**
 * Creates a new PlannerSend record.
 */
export function createPlannerSend(
  payload: PlannerSendPayload,
  result: PlannerSendResult
): PlannerSend {
  return {
    sent_at: new Date().toISOString(),
    payload,
    result,
  };
}
