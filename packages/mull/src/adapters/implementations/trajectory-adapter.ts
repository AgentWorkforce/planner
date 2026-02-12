import Database from 'better-sqlite3';
import type { SessionAdapter, SessionEntry, Cursor, TimeRange, AdapterSessionInfo } from '../core-types.js';
import type { TrajectoryAdapterConfig } from '../schemas.js';

/** Row shape for trajectory_events table in planner.db. */
interface TrajectoryEventRow {
  event_id: string;
  type: string;
  question_id: string;
  asking_agent: string;
  question_text: string;
  context_provided: string | null;
  options_presented_json: string;
  selected_option: string | null;
  free_text_response: string | null;
  reasoning: string | null;
  plan_id: string;
  step_id: string | null;
  agent_trajectory_ref: string | null;
  timestamp: string;
}

/** Row shape for listSessions aggregate query. */
interface SessionAggregateRow {
  plan_id: string;
  started_at: string;
  ended_at: string;
}

/**
 * Reads session data from the planner trajectory_events table (read-only).
 *
 * Sessions are identified by plan_id. Each row is a DecisionEvent containing:
 * question_text, options_presented (JSON array), selected_option,
 * free_text_response, reasoning, asking_agent, step_id.
 *
 * These map to SessionEntry with type 'decision' so the loader's
 * entriesToSessionData classifies them as SessionDecision[].
 */
export class TrajectoryAdapter implements SessionAdapter {
  readonly type = 'trajectory' as const;

  private readonly db: Database.Database;

  constructor(config: TrajectoryAdapterConfig) {
    this.db = new Database(config.dbPath, { readonly: true });
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Read decision events for a plan, ordered by timestamp ascending.
   * Supports cursor-based incremental reads via `since.last_mulled_at`.
   */
  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    const params: unknown[] = [sessionId];

    let sql = `
      SELECT event_id, type, question_id, asking_agent, question_text,
             context_provided, options_presented_json, selected_option,
             free_text_response, reasoning, plan_id, step_id,
             agent_trajectory_ref, timestamp
      FROM trajectory_events
      WHERE plan_id = ?`;

    if (since?.last_mulled_at) {
      sql += `\n        AND timestamp > ?`;
      params.push(since.last_mulled_at);
    }

    sql += `\n      ORDER BY timestamp ASC`;

    const rows = this.db.prepare(sql).all(...params) as TrajectoryEventRow[];

    return rows.map(row => this.rowToEntry(row));
  }

  /**
   * List all sessions (plan_ids) with their time ranges.
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
        plan_id,
        MIN(timestamp) AS started_at,
        MAX(timestamp) AS ended_at
      FROM trajectory_events
      GROUP BY plan_id
      ${having}
      ORDER BY started_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as SessionAggregateRow[];

    return rows.map(row => ({
      sessionId: row.plan_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }));
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
   * Maps to type 'decision' so entriesToSessionData classifies it as
   * SessionDecision. The content includes:
   *  - id / description / rationale for SessionDecision extraction
   *  - Full planner fields for downstream consumers that need richer context
   */
  private rowToEntry(row: TrajectoryEventRow): SessionEntry {
    const optionsPresented = safeJsonParse(row.options_presented_json, row.event_id);

    return {
      timestamp: row.timestamp,
      source: 'trajectory',
      type: 'decision',
      content: {
        id: row.event_id,
        description: row.question_text,
        rationale: row.reasoning ?? undefined,
        question_text: row.question_text,
        options_presented: optionsPresented,
        selected_option: row.selected_option ?? undefined,
        free_text_response: row.free_text_response ?? undefined,
        reasoning: row.reasoning ?? undefined,
        asking_agent: row.asking_agent,
        step_id: row.step_id ?? undefined,
        question_id: row.question_id,
        context_provided: row.context_provided ?? undefined,
      },
    };
  }
}

/**
 * Safely parse a JSON string, returning an empty array on failure.
 * Logs a warning so corrupted payloads are visible but don't crash the adapter.
 */
function safeJsonParse(json: string, contextId: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    console.warn(`TrajectoryAdapter: failed to parse options_presented_json for event ${contextId}`);
    return [];
  }
}
