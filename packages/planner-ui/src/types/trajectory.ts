/**
 * Decision event recorded to user trajectory.
 * Captures user answers to agent questions.
 */
export interface DecisionEvent {
  /** Unique event ID */
  event_id: string;
  /** Event type - always 'decision' for user decisions */
  type: 'decision';
  /** ID of the question being answered */
  question_id: string;
  /** Role of agent that asked */
  asking_agent: string;
  /** The question text */
  question_text: string;
  /** Optional context provided by agent */
  context_provided?: string;
  /** Options presented to user */
  options_presented: string[];
  /** The option selected (null if free text only) */
  selected_option: string | null;
  /** Free text response if provided */
  free_text_response?: string;
  /** User's reasoning for the choice */
  reasoning?: string;
  /** Plan this decision belongs to */
  plan_id: string;
  /** Optional step this relates to */
  step_id?: string;
  /** Reference to agent's trajectory (for linking) */
  agent_trajectory_ref: string;
  /** When the decision was made */
  timestamp: string;
}

/**
 * Preference derived from trajectory analysis.
 * Shows patterns in user decisions.
 */
export interface DerivedPreference {
  /** Unique preference ID */
  preference_id: string;
  /** Category of preference (e.g., 'architecture', 'testing', 'naming') */
  category: string;
  /** Human-readable preference text */
  preference_text: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Decision events that support this preference */
  supporting_decisions: string[];
  /** When this was derived */
  derived_at: string;
}

/**
 * Filter options for querying events.
 */
export interface EventFilter {
  /** Filter by asking agent */
  agent?: string;
  /** Filter by date range (start) */
  from_date?: string;
  /** Filter by date range (end) */
  to_date?: string;
  /** Limit results */
  limit?: number;
}

/**
 * Similar question match result.
 */
export interface SimilarQuestion {
  /** The matching decision event */
  event: DecisionEvent;
  /** Similarity score 0-1 */
  similarity: number;
}
