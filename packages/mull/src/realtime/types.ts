/**
 * Types for the real-time trigger system.
 *
 * Two trigger layers:
 *   1. Deterministic — runs on every significant event (<100ms, no batching)
 *   2. LLM — batched: 3+ entities, decision events, 20-min timer, or session end
 */

import { z } from 'zod';
import { EntitySchema, FactSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Incoming event shapes (from forge, planner, relay)
// ---------------------------------------------------------------------------

/** A trajectory event from forge-core's TrajectoryCapture. */
export interface ForgeTrajectoryEvent {
  event_id: string;
  run_id: string;
  task_id?: string;
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** A planner decision event from planner.db trajectory_events table. */
export interface PlannerDecisionEvent {
  event_id: string;
  plan_id: string;
  step_id?: string;
  type: string;
  question_text: string;
  selected_option?: string;
  reasoning?: string;
  asking_agent?: string;
  timestamp: string;
}

/** A relay message from the agent-relay daemon. */
export interface RelayMessageEvent {
  id: string;
  from: string;
  to: string;
  kind: string;
  body: string;
  ts: number; // epoch ms
  channel?: string;
}

// ---------------------------------------------------------------------------
// Trigger configuration
// ---------------------------------------------------------------------------

export const TriggerConfigSchema = z.object({
  /** Enable or disable real-time triggers. Default: true */
  enabled: z.boolean().default(true),

  /** Minimum entities accumulated before LLM trigger fires. Default: 3 */
  minEntitiesForLlm: z.number().int().positive().default(3),

  /** Timer interval in ms for periodic LLM batch trigger. Default: 20 minutes */
  llmTimerIntervalMs: z.number().int().positive().default(20 * 60 * 1000),

  /** Directory for persisting accumulator state. Default: '.mull' */
  mullDir: z.string().default('.mull'),

  /** Memory directory for topic files. Default: './memory' */
  memoryDir: z.string().default('./memory'),
});

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

// ---------------------------------------------------------------------------
// Accumulator state (persisted to disk for restart survival)
// ---------------------------------------------------------------------------

export const AccumulatorStateSchema = z.object({
  /** Session ID this accumulator tracks. */
  sessionId: z.string().min(1),

  /** Entities extracted since last LLM run. */
  entitiesSinceLastLlm: z.array(EntitySchema).default([]),

  /** Facts extracted since last LLM run. */
  factsSinceLastLlm: z.array(FactSchema).default([]),

  /** ISO timestamp of last LLM batch run (null = never). */
  lastLlmRunAt: z.string().datetime().nullable().default(null),

  /** ISO timestamp of last deterministic run (null = never). */
  lastDeterministicAt: z.string().datetime().nullable().default(null),
});

export type AccumulatorState = z.infer<typeof AccumulatorStateSchema>;

// ---------------------------------------------------------------------------
// Trigger results
// ---------------------------------------------------------------------------

export type TriggerLayer = 'deterministic' | 'llm';

export interface TriggerResult {
  layer: TriggerLayer;
  sessionId: string;
  /** Whether the pipeline was invoked. */
  triggered: boolean;
  /** Summary of what happened (for logging). */
  reason: string;
  /** Entities/facts extracted by deterministic layer (accumulated for LLM). */
  entitiesExtracted?: number;
  factsExtracted?: number;
}

// ---------------------------------------------------------------------------
// High-signal event types from forge
// ---------------------------------------------------------------------------

/**
 * Forge event types that are high-signal for mull extraction.
 * These are the only forge events that trigger deterministic processing.
 */
export const HIGH_SIGNAL_FORGE_EVENTS = new Set([
  'decision_recorded',
  'checkpoint_created',
  'retrospective_recorded',
  'agent_spawned',
  'task_completed',
  'task_failed',
  'gate_reached',
  'gate_approved',
  'gate_rejected',
  'budget_warning',
  'recovery_strategy_selected',
] as const);

/**
 * Decision-type events that trigger immediate LLM batch processing
 * (bypass the accumulation threshold).
 */
export const DECISION_EVENT_TYPES = new Set([
  'decision_recorded',
  'gate_approved',
  'gate_rejected',
  'retrospective_recorded',
] as const);

/**
 * Events that signal session end, triggering a final LLM flush.
 */
export const SESSION_END_EVENTS = new Set([
  'run_completed',
  'run_failed',
  'run_cancelled',
] as const);
