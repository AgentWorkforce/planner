// Real-time Trigger Type Schemas
// State tracking for entity accumulation between LLM and deterministic runs

import { z } from 'zod';
import { EntitySchema, FactSchema } from './types.js';

// --- Entity Accumulator State (persisted to .mull/ for restart survival) ---

export const EntityAccumulatorStateSchema = z.object({
  sessionId: z.string().min(1),
  entitiesSinceLastLlm: z.array(EntitySchema).default([]),
  factsSinceLastLlm: z.array(FactSchema).default([]),
  lastLlmRunAt: z.string().datetime().optional(),
  lastDeterministicAt: z.string().datetime().optional(),
});

export type EntityAccumulatorState = z.infer<typeof EntityAccumulatorStateSchema>;
