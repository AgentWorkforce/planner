/**
 * Ideation Domain - ActiveSpecialist Schema
 *
 * Tracks spawned specialists for a session.
 * Used for lazy spawning management and cleanup on session abandon.
 */

import { z } from 'zod';

// =============================================================================
// ActiveSpecialist Schema
// =============================================================================

/**
 * Represents a currently spawned specialist agent for a session.
 *
 * Specialists are spawned lazily by the Interviewer when expertise is needed.
 * The name is used as the key in the Understanding map.
 */
export const ActiveSpecialistSchema = z.object({
  /** The specialist identifier, used as key in Understanding */
  name: z.string(),
  /** The relay agent ID for this specialist */
  agent_id: z.string(),
  /** When this specialist was spawned (ISO 8601) */
  spawned_at: z.string(),
  /** Optional description of specialist focus (for UI display) */
  role_hint: z.string().optional(),
});

export type ActiveSpecialist = z.infer<typeof ActiveSpecialistSchema>;

/**
 * Creates a new ActiveSpecialist record.
 */
export function createActiveSpecialist(
  name: string,
  agent_id: string,
  role_hint?: string
): ActiveSpecialist {
  return {
    name,
    agent_id,
    spawned_at: new Date().toISOString(),
    role_hint,
  };
}
