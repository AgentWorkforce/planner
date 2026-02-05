/**
 * Ideation Storage Interface
 *
 * Defines the contract for persisting Sessions.
 * No Nugget entity - understanding is live state sent to planner as snapshot.
 */

import type {
  Session,
  SessionStatus,
  TranscriptMessage,
  ActiveSpecialist,
  PlannerSend,
  SessionSource,
  Block,
} from '../domain/index.js';

export interface IdeationStorage {
  // ==========================================================================
  // Session Operations
  // ==========================================================================

  /**
   * Create a new ideation session.
   */
  createSession(source: SessionSource, initiative_id?: string): Promise<Session>;

  /**
   * Get a session by ID.
   */
  getSession(id: string): Promise<Session | null>;

  /**
   * List sessions with optional filtering.
   */
  listSessions(filter?: {
    status?: SessionStatus;
    initiative_id?: string;
  }): Promise<Session[]>;

  /**
   * Update session status.
   */
  updateSessionStatus(id: string, status: SessionStatus): Promise<Session>;

  /**
   * Update session fields.
   * Currently supports updating title (stored as source.initial_intent).
   */
  updateSession(id: string, updates: { title?: string }): Promise<Session>;

  /**
   * Append a message to the session transcript.
   * Uses efficient JSON append, not full replacement.
   */
  appendTranscript(sessionId: string, message: TranscriptMessage): Promise<Session>;

  /**
   * Update observations for a specific specialist.
   * Merges freeform observations without overwriting other specialists.
   */
  updateUnderstanding(
    sessionId: string,
    specialistName: string,
    observations: Record<string, unknown>
  ): Promise<Session>;

  /**
   * Add an active specialist to the session.
   */
  addActiveSpecialist(sessionId: string, specialist: ActiveSpecialist): Promise<Session>;

  /**
   * Remove an active specialist by name.
   */
  removeActiveSpecialist(sessionId: string, specialistName: string): Promise<Session>;

  /**
   * Append a planner send record to the session.
   * Full payload snapshot for audit trail.
   */
  appendPlannerSend(sessionId: string, send: PlannerSend): Promise<Session>;

  /**
   * Update the entire blocks array for a session.
   * Replaces all blocks with the provided array.
   */
  updateBlocks(sessionId: string, blocks: Block[]): Promise<Session>;

  /**
   * Update the synthesized AI understanding for a session.
   * Updates the synthesized field with idea summary and specialist perspectives.
   */
  updateSynthesis(
    sessionId: string,
    synthesis: {
      idea_summary: string;
      specialist_perspectives: Record<string, {
        take: string;
        concerns: string[];
        confidence: 'exploring' | 'forming' | 'confident';
      }>;
    }
  ): Promise<Session>;

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Initialize storage (create tables, etc.).
   */
  initialize(): Promise<void>;

  /**
   * Close storage connections.
   */
  close(): Promise<void>;
}
