/**
 * Ideation Domain - Session Schema
 *
 * A Session is a brainstorming conversation that captures understanding
 * from dynamic specialists. Sessions stay active after sending to planner.
 */

import { z } from 'zod';
import { SessionStatusSchema } from './types.js';
import { UnderstandingSchema } from './understanding.js';
import { TranscriptMessageSchema } from './transcript.js';
import { PlannerSendSchema } from './planner-send.js';
import { ActiveSpecialistSchema } from './active-specialist.js';
import { BlockSchema } from './block.js';

// =============================================================================
// Session Source Schema
// =============================================================================

/**
 * Where the session originated from.
 * Mode B (human-initiated) is the MVP focus.
 */
export const SessionSourceSchema = z.object({
  /** How this session was initiated */
  type: z.literal('human'),
  /** The initial intent/idea that started this session */
  initial_intent: z.string(),
});

export type SessionSource = z.infer<typeof SessionSourceSchema>;

// =============================================================================
// Session Schema
// =============================================================================

/**
 * An ideation session - a brainstorming conversation.
 *
 * Key characteristics:
 * - Sessions stay active after sending to planner (can continue ideating)
 * - Only 'active' | 'abandoned' status (no crystallized/promoted states)
 * - Transcript is user + assistant only (specialists are invisible)
 * - Understanding is freeform, keyed by specialist name
 * - planner_sends[] tracks history of all sends (append-only)
 * - active_specialists[] tracks currently spawned agents
 * - blocks[] stores the structured understanding as Block entities
 */
export const SessionSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** Current status: 'active' or 'abandoned' */
  status: SessionStatusSchema,
  /** Optional initiative this session belongs to */
  initiative_id: z.string().optional(),
  /** Source information including initial intent */
  source: SessionSourceSchema,
  /** Conversation transcript (user + assistant only) */
  transcript: z.array(TranscriptMessageSchema),
  /** Freeform understanding from specialists */
  understanding: UnderstandingSchema,
  /** Currently spawned specialist agents */
  active_specialists: z.array(ActiveSpecialistSchema),
  /** History of all sends to planner (append-only) */
  planner_sends: z.array(PlannerSendSchema),
  /** Structured understanding as blocks for canvas display */
  blocks: z.array(BlockSchema).default([]),
  /** When this session was created (ISO 8601) */
  created_at: z.string(),
  /** When this session was last updated (ISO 8601) */
  updated_at: z.string(),

  // V3-prep: Handoff tracking fields
  // These mirror planner_sends[-1] for quick access in UI
  /** ISO timestamp of last handoff to planner */
  lastHandoffAt: z.string().optional(),
  /** Plan UUID from last handoff */
  lastHandoffPlanId: z.string().optional(),
  /** Plan version number from last handoff */
  lastHandoffVersionId: z.number().optional(),

  // V3-prep: Synthesized AI understanding
  synthesized: z.object({
    idea_summary: z.string().optional(),
    specialist_perspectives: z.record(z.object({
      take: z.string(),
      concerns: z.array(z.string()),
      confidence: z.enum(['exploring', 'forming', 'confident']),
    })).optional(),
  }).optional(),
});

export type Session = z.infer<typeof SessionSchema>;

/**
 * Creates a new Session with generated ID and timestamps.
 */
export function createSession(
  initial_intent: string,
  initiative_id?: string
): Session {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    status: 'active',
    initiative_id,
    source: {
      type: 'human',
      initial_intent,
    },
    transcript: [],
    understanding: {},
    active_specialists: [],
    planner_sends: [],
    blocks: [],
    created_at: now,
    updated_at: now,
    // V3-prep fields - undefined until handoff
    lastHandoffAt: undefined,
    lastHandoffPlanId: undefined,
    lastHandoffVersionId: undefined,
    synthesized: undefined,
  };
}
