/**
 * Ideation Storage Interface
 *
 * Defines the contract for persisting Sessions and Nuggets.
 * Implementations can use SQLite, PostgreSQL, or other backends.
 */

import type {
  Session,
  SessionStatus,
  Nugget,
  TranscriptMessage,
  AgentObservations,
  CreateSessionRequest,
  CrystallizeRequest,
} from '../domain/index.js';

export interface IdeationStorage {
  // ==========================================================================
  // Session Operations
  // ==========================================================================

  /**
   * Create a new ideation session.
   */
  createSession(request: CreateSessionRequest): Promise<Session>;

  /**
   * Get a session by ID.
   */
  getSession(id: string): Promise<Session | null>;

  /**
   * List sessions with optional filtering.
   */
  listSessions(options?: {
    status?: SessionStatus;
    limit?: number;
    offset?: number;
  }): Promise<Session[]>;

  /**
   * Update session status.
   */
  updateSessionStatus(id: string, status: SessionStatus): Promise<Session>;

  /**
   * Append a message to the session transcript.
   */
  appendMessage(sessionId: string, message: Omit<TranscriptMessage, 'timestamp'>): Promise<Session>;

  /**
   * Update observations for a specific agent role.
   * Merges with existing observations, doesn't replace other roles.
   */
  updateObservations(
    sessionId: string,
    role: string,
    observations: AgentObservations
  ): Promise<Session>;

  /**
   * Delete a session (and its nugget if exists).
   */
  deleteSession(id: string): Promise<void>;

  // ==========================================================================
  // Nugget Operations
  // ==========================================================================

  /**
   * Crystallize a session into a nugget.
   * Creates the nugget and updates session status to 'crystallized'.
   */
  crystallizeSession(sessionId: string, request: CrystallizeRequest): Promise<Nugget>;

  /**
   * Get a nugget by ID.
   */
  getNugget(id: string): Promise<Nugget | null>;

  /**
   * Get nugget by session ID.
   */
  getNuggetBySession(sessionId: string): Promise<Nugget | null>;

  /**
   * Mark nugget as promoted (linked to a plan).
   * Updates session status to 'promoted' and stores plan_id on nugget.
   */
  promoteNugget(nuggetId: string, planId: string): Promise<Nugget>;

  /**
   * List all nuggets.
   */
  listNuggets(options?: { limit?: number; offset?: number }): Promise<Nugget[]>;

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
