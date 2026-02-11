import Database from 'better-sqlite3';
import type { SessionAdapter, SessionEntry, Cursor, TimeRange, AdapterSessionInfo } from '../core-types.js';

/** Configuration for ForgeDbAdapter. */
export interface ForgeDbAdapterConfig {
  /** Path to the forge SQLite database file. */
  dbPath: string;
  /** Whether to load user trajectory events (per-user decision history). */
  includeUserTrajectory?: boolean;
  /** Whether to load derived preferences (inferred user preferences). */
  includePreferences?: boolean;
}

/** Row shape for user_trajectory_events table. */
export interface UserTrajectoryEventRow {
  event_id: string;
  user_id: string;
  scope: string;
  question_text: string;
  selected_option: string;
  reasoning: string | null;
  run_id: string | null;
  task_id: string | null;
  project_id: string | null;
  category: string | null;
  timestamp: string;
}

/** Row shape for user_preferences table. */
export interface DerivedPreferenceRow {
  preference_id: string;
  user_id: string;
  scope: string;
  project_id: string | null;
  run_id: string | null;
  category: string;
  value: string;
  confidence: number;
  evidence_count: number;
  last_expressed: string;
  is_override: number;
  created_at: string;
  updated_at: string;
}

/**
 * Reads session data from the forge SQLite database (read-only).
 *
 * Provides trajectory events from forge runs, plus optional
 * user trajectory events and derived preferences for cross-run
 * pattern detection.
 */
export class ForgeDbAdapter implements SessionAdapter {
  readonly type = 'forge' as const;

  private readonly db: Database.Database;
  private readonly includeUserTrajectory: boolean;
  private readonly includePreferences: boolean;

  constructor(config: ForgeDbAdapterConfig) {
    this.db = new Database(config.dbPath, { readonly: true });
    this.db.pragma('foreign_keys = ON');
    this.includeUserTrajectory = config.includeUserTrajectory ?? false;
    this.includePreferences = config.includePreferences ?? false;
  }

  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    // Will query trajectory_events filtered by high-signal event types
    void sessionId;
    void since;
    return [];
  }

  async listSessions(_timeRange?: TimeRange): Promise<AdapterSessionInfo[]> {
    // Will query distinct run_ids with their time ranges
    return [];
  }

  /** Load user trajectory events for a given user. */
  async loadUserTrajectory(userId: string): Promise<UserTrajectoryEventRow[]> {
    if (!this.includeUserTrajectory) return [];
    void userId;
    return [];
  }

  /** Load derived preferences for a given user above a confidence threshold. */
  async loadDerivedPreferences(userId: string, minConfidence = 0.7): Promise<DerivedPreferenceRow[]> {
    if (!this.includePreferences) return [];
    void userId;
    void minConfidence;
    return [];
  }

  /** Close the read-only database connection. */
  close(): void {
    this.db.close();
  }
}
