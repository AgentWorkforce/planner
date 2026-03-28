import { z } from 'zod';

/**
 * Decision event schema matching AgentWorkforce/trajectories format.
 * Records user decisions during planning sessions.
 */
export const DecisionEventSchema = z.object({
  event_id: z.string().uuid(),
  type: z.literal('decision'),
  question_id: z.string().uuid(),
  asking_agent: z.string(),
  question_text: z.string(),
  context_provided: z.string().optional(),
  options_presented: z.array(z.string()),
  selected_option: z.string().nullable(),
  free_text_response: z.string().optional(),
  reasoning: z.string().optional(),
  plan_id: z.string().uuid(),
  step_id: z.string().optional(),
  agent_trajectory_ref: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type DecisionEvent = z.infer<typeof DecisionEventSchema>;

/**
 * Derived preference from trajectory analysis.
 * Represents learned user preferences extracted from decision history.
 */
export const DerivedPreferenceSchema = z.object({
  preference_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  category: z.string(),
  preference_text: z.string(),
  confidence: z.number().min(0).max(1),
  source_event_ids: z.array(z.string().uuid()),
  created_at: z.string().datetime(),
});

export type DerivedPreference = z.infer<typeof DerivedPreferenceSchema>;

/**
 * Filter for querying trajectory events.
 */
export interface TrajectoryEventFilter {
  agent_id?: string;
  event_type?: 'decision';
  from_date?: string;
  to_date?: string;
  step_id?: string;
}

/**
 * Creates a new decision event with generated UUID and timestamp.
 */
export function createDecisionEvent(
  data: Omit<DecisionEvent, 'event_id' | 'type' | 'timestamp'>
): DecisionEvent {
  const event: DecisionEvent = {
    event_id: crypto.randomUUID(),
    type: 'decision',
    timestamp: new Date().toISOString(),
    ...data,
  };
  return DecisionEventSchema.parse(event);
}

/**
 * Creates a derived preference with generated UUID and timestamp.
 */
export function createDerivedPreference(
  data: Omit<DerivedPreference, 'preference_id' | 'created_at'>
): DerivedPreference {
  const preference: DerivedPreference = {
    preference_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...data,
  };
  return DerivedPreferenceSchema.parse(preference);
}
