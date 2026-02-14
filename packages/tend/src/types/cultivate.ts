/**
 * Cultivate types — forward-compatibility stubs for intake integration.
 *
 * Cultivate monitors external channels (Slack, GitHub, support, analytics)
 * for signals that feed into the planning process. These types define
 * the contract tend expects when cultivate ships.
 *
 * Not implemented yet — these are architectural touch points only.
 */

/** A signal from an external channel detected by cultivate */
export interface Signal {
  id: string;
  source: SignalSource;
  content: string;
  relevance_score: number;
  project_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/** Known signal sources */
export type SignalSource = 'slack' | 'github' | 'support' | 'analytics' | 'user-interview';

/** Provenance linking a step back to its originating signals */
export interface SignalProvenance {
  signal_id: string;
  source: SignalSource;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/** Content source discriminator for the left column */
export type ContentSource = 'forming-blocks' | 'cultivate-signals';
