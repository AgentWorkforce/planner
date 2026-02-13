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

/** Row shape for trajectory_events table. */
interface TrajectoryEventRow {
  event_id: string;
  run_id: string;
  task_id: string | null;
  event_type: string;
  payload: string;
  timestamp: string;
}

/** Row shape for listSessions aggregate query. */
interface SessionAggregateRow {
  run_id: string;
  started_at: string;
  ended_at: string;
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
 * High-signal event types worth extracting for knowledge synthesis.
 * Not all 40+ forge event types are useful — these capture decisions,
 * outcomes, structural changes, and retrospective insights.
 */
const HIGH_SIGNAL_EVENT_TYPES = [
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
] as const;

/** Build a SQL IN-clause placeholder string for the high-signal types. */
const IN_PLACEHOLDERS = HIGH_SIGNAL_EVENT_TYPES.map(() => '?').join(', ');

/**
 * Reads session data from the forge SQLite database (read-only).
 *
 * Provides trajectory events from forge runs, plus optional
 * user trajectory events and derived preferences for cross-run
 * pattern detection.
 *
 * Sessions are identified by run_id. The adapter filters to high-signal
 * event types to avoid noise from the 40+ trajectory event types.
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

  /**
   * Read trajectory events for a run, filtered to high-signal types.
   * Returns SessionEntry[] sorted by timestamp ascending.
   *
   * Event type mapping:
   * - decision_recorded → type 'decision' (for SessionDecision extraction)
   * - retrospective_recorded → type 'retrospective' (for retrospective string extraction)
   * - all others → type matches event_type (become SessionEvent via loader)
   */
  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    const params: unknown[] = [sessionId, ...HIGH_SIGNAL_EVENT_TYPES];

    let sql = `
      SELECT event_id, run_id, task_id, event_type, payload, timestamp
      FROM trajectory_events
      WHERE run_id = ?
        AND event_type IN (${IN_PLACEHOLDERS})`;

    if (since?.last_mulled_at) {
      sql += `\n        AND timestamp > ?`;
      params.push(since.last_mulled_at);
    }

    sql += `\n      ORDER BY timestamp ASC`;

    const rows = this.db.prepare(sql).all(...params) as TrajectoryEventRow[];

    return rows.map(row => this.rowToEntry(row));
  }

  /**
   * List all sessions (run_ids) with their time ranges.
   * Optionally filtered to a time window.
   */
  async listSessions(timeRange?: TimeRange): Promise<AdapterSessionInfo[]> {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (timeRange?.after) {
      conditions.push('MAX(timestamp) >= ?');
      params.push(timeRange.after);
    }
    if (timeRange?.before) {
      conditions.push('MIN(timestamp) <= ?');
      params.push(timeRange.before);
    }

    const having = conditions.length > 0
      ? `HAVING ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT
        run_id,
        MIN(timestamp) AS started_at,
        MAX(timestamp) AS ended_at
      FROM trajectory_events
      GROUP BY run_id
      ${having}
      ORDER BY started_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as SessionAggregateRow[];

    return rows.map(row => ({
      sessionId: row.run_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }));
  }

  /** Load user trajectory events for a given user, ordered by timestamp. */
  async loadUserTrajectory(userId: string, scope?: 'global' | 'project' | 'run'): Promise<UserTrajectoryEventRow[]> {
    if (!this.includeUserTrajectory) return [];

    const params: unknown[] = [userId];
    let sql = `
      SELECT event_id, user_id, scope, question_text, selected_option,
             reasoning, run_id, task_id, project_id, category, timestamp
      FROM user_trajectory_events
      WHERE user_id = ?`;

    if (scope) {
      sql += `\n        AND scope = ?`;
      params.push(scope);
    }

    sql += `\n      ORDER BY timestamp ASC`;

    return this.db.prepare(sql).all(...params) as UserTrajectoryEventRow[];
  }

  /** Load derived preferences for a given user above a confidence threshold. */
  async loadDerivedPreferences(userId: string, minConfidence = 0.7): Promise<DerivedPreferenceRow[]> {
    if (!this.includePreferences) return [];

    const sql = `
      SELECT preference_id, user_id, scope, project_id, run_id,
             category, value, confidence, evidence_count, last_expressed,
             is_override, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ?
        AND confidence >= ?
      ORDER BY confidence DESC, evidence_count DESC`;

    return this.db.prepare(sql).all(userId, minConfidence) as DerivedPreferenceRow[];
  }

  /** Close the read-only database connection. */
  close(): void {
    this.db.close();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a trajectory_events row to a SessionEntry.
   *
   * Special handling:
   * - decision_recorded: mapped to type 'decision' with structured content
   *   for extraction as SessionDecision by entriesToSessionData.
   * - retrospective_recorded: mapped to type 'retrospective' with a
   *   serialized retrospective string for the SessionData.retrospective field.
   * - all other high-signal types: mapped with event_type as entry type,
   *   parsed payload as content (become SessionEvent via loader).
   */
  private rowToEntry(row: TrajectoryEventRow): SessionEntry {
    const payload = safeJsonParse(row.payload, row.event_id);

    switch (row.event_type) {
      case 'decision_recorded':
        return {
          timestamp: row.timestamp,
          source: 'forge',
          type: 'decision',
          content: {
            id: row.event_id,
            description: (payload as Record<string, unknown>).decision ?? '',
            rationale: (payload as Record<string, unknown>).reasoning ?? undefined,
            agent_id: (payload as Record<string, unknown>).agent_id ?? undefined,
            alternatives: (payload as Record<string, unknown>).alternatives ?? undefined,
            context: (payload as Record<string, unknown>).context ?? undefined,
          },
        };

      case 'retrospective_recorded': {
        // The payload has { task_id, agent_id, retrospective: { summary, approach, decisions, ... } }
        const retroPayload = (payload as Record<string, unknown>).retrospective as Record<string, unknown> | undefined;

        if (!retroPayload) {
          return {
            timestamp: row.timestamp,
            source: 'forge',
            type: 'retrospective',
            content: '',
          };
        }

        // Parse the forge LinkedRetrospective into a structured object
        // Forge schema: { summary, approach, decisions: [{ question, chosen, reasoning, linked_event_ids? }], challenges: string[], learnings: string[], suggestions: string[], confidence }
        const decisions = (retroPayload.decisions as Array<Record<string, unknown>> | undefined)?.map(d => ({
          question: String(d.question ?? ''),
          chosen: String(d.chosen ?? ''),
          reasoning: String(d.reasoning ?? ''),
          // Causal link: linked_event_ids connects decisions to their outcomes
          linkedEventIds: (d.linked_event_ids as string[] | undefined) ?? undefined,
        })) ?? [];

        // Convert array fields to strings for mull's retrospective format
        const challenges = Array.isArray(retroPayload.challenges)
          ? (retroPayload.challenges as string[]).join('\n')
          : undefined;
        const lessonsLearned = Array.isArray(retroPayload.learnings)
          ? (retroPayload.learnings as string[]).join('\n')
          : undefined;
        const suggestions = Array.isArray(retroPayload.suggestions)
          ? (retroPayload.suggestions as string[]).join('\n')
          : undefined;

        const structuredRetro = {
          summary: String(retroPayload.summary ?? ''),
          approach: retroPayload.approach ? String(retroPayload.approach) : undefined,
          decisions: decisions.length > 0 ? decisions : undefined,
          challenges,
          lessonsLearned,
          suggestions,
          confidence: typeof retroPayload.confidence === 'number' ? retroPayload.confidence : undefined,
        };

        // Serialize the structured retrospective to JSON for storage in SessionData.retrospective (string field)
        return {
          timestamp: row.timestamp,
          source: 'forge',
          type: 'retrospective',
          content: JSON.stringify(structuredRetro),
        };
      }

      default:
        return {
          timestamp: row.timestamp,
          source: 'forge',
          type: row.event_type,
          content: {
            ...payload as Record<string, unknown>,
            _event_id: row.event_id,
            _task_id: row.task_id,
          },
        };
    }
  }
}

/**
 * Safely parse a JSON string, returning an empty object on failure.
 * Logs a warning so corrupted payloads are visible but don't crash the adapter.
 */
function safeJsonParse(json: string, contextId: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    console.warn(`ForgeDbAdapter: failed to parse payload for event ${contextId}`);
    return {};
  }
}
