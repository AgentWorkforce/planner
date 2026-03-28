/**
 * BatonAdapter — reads structured handoff documents (batons) from forge.db.
 *
 * Batons are concise, pre-structured summaries written by agents at phase
 * boundaries. They contain decisions, gotchas, artifacts, and state —
 * exactly the high-signal data mull extracts, but already distilled.
 *
 * This adapter converts baton fields directly to SessionEntry types,
 * bypassing the need for NLP entity extraction on baton content.
 */

import Database from 'better-sqlite3';
import type { SessionAdapter, SessionEntry, Cursor, TimeRange, AdapterSessionInfo } from '../core-types.js';

/** Configuration for BatonAdapter. */
export interface BatonAdapterConfig {
  /** Path to the forge SQLite database file. */
  dbPath: string;
}

/** Row shape from the batons table. */
interface BatonRow {
  id: string;
  run_id: string;
  phase_id: string;
  step_id: string;
  content: string;
  created_at: string;
}

/** Row shape for listSessions aggregate query. */
interface SessionAggregateRow {
  run_id: string;
  started_at: string;
  ended_at: string;
}

/** Parsed StepBaton JSON shape from baton content. */
interface StepBaton {
  run_id: string;
  phase_id: string;
  completed_steps?: Array<{ step_id: string; title: string; summary: string }>;
  artifacts?: Array<{ path: string; description: string }>;
  gotchas?: string[];
  decisions?: Array<{ what: string; why: string }>;
  state?: string;
  git_ref?: string;
}

/**
 * Reads session data from the batons table in the forge SQLite database (read-only).
 *
 * Sessions are identified by run_id. Each baton row contains pre-distilled
 * phase summaries that map directly to SessionEntry types without requiring
 * NLP extraction — decisions map to 'decision' entries, gotchas and artifacts
 * become 'message' entries with constraint/file keywords.
 */
export class BatonAdapter implements SessionAdapter {
  readonly type = 'baton' as const;

  private readonly dbPath: string;

  constructor(config: BatonAdapterConfig) {
    this.dbPath = config.dbPath;
  }

  private openDb(): Database.Database {
    const db = new Database(this.dbPath, { readonly: true });
    db.pragma('foreign_keys = ON');
    return db;
  }

  /**
   * Read baton entries for a run, converting each baton's fields into
   * SessionEntry records. Returns entries sorted by created_at ascending.
   */
  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    const db = this.openDb();
    try {
      const params: unknown[] = [sessionId];
      let sql = 'SELECT id, run_id, phase_id, step_id, content, created_at FROM batons WHERE run_id = ?';

      if (since?.last_mulled_at) {
        sql += ' AND created_at > ?';
        params.push(since.last_mulled_at);
      }

      sql += ' ORDER BY created_at ASC';

      const rows = db.prepare(sql).all(...params) as BatonRow[];
      const entries: SessionEntry[] = [];

      for (const row of rows) {
        let baton: StepBaton;
        try {
          baton = JSON.parse(row.content) as StepBaton;
        } catch {
          console.warn(`[BatonAdapter] Failed to parse baton ${row.id}, skipping`);
          continue;
        }

        // Convert decisions to 'decision' entries — matched by entriesToSessionData
        if (baton.decisions && Array.isArray(baton.decisions)) {
          for (const decision of baton.decisions) {
            entries.push({
              timestamp: row.created_at,
              source: 'baton',
              type: 'decision',
              content: {
                id: `${row.id}-decision-${entries.length}`,
                description: decision.what,
                rationale: decision.why,
              },
            });
          }
        }

        // Convert gotchas to message entries with constraint keyword for extract.ts filtering
        if (baton.gotchas && Array.isArray(baton.gotchas)) {
          for (const gotcha of baton.gotchas) {
            entries.push({
              timestamp: row.created_at,
              source: 'baton',
              type: 'message',
              content: {
                role: 'assistant',
                content: `Constraint/gotcha: ${gotcha}`,
              },
            });
          }
        }

        // Convert artifacts to a single message entry listing all files
        if (baton.artifacts && Array.isArray(baton.artifacts) && baton.artifacts.length > 0) {
          const artifactList = baton.artifacts
            .map(a => `- ${a.path}: ${a.description}`)
            .join('\n');
          entries.push({
            timestamp: row.created_at,
            source: 'baton',
            type: 'message',
            content: {
              role: 'assistant',
              content: `Files created/modified:\n${artifactList}`,
            },
          });
        }

        // Convert completed steps to a single message entry
        if (baton.completed_steps && Array.isArray(baton.completed_steps) && baton.completed_steps.length > 0) {
          const stepList = baton.completed_steps
            .map(s => `- ${s.title}: ${s.summary}`)
            .join('\n');
          entries.push({
            timestamp: row.created_at,
            source: 'baton',
            type: 'message',
            content: {
              role: 'assistant',
              content: `Completed steps:\n${stepList}`,
            },
          });
        }

        // Convert state to message entry
        if (baton.state) {
          entries.push({
            timestamp: row.created_at,
            source: 'baton',
            type: 'message',
            content: {
              role: 'assistant',
              content: `Current state: ${baton.state}`,
            },
          });
        }
      }

      return entries;
    } finally {
      db.close();
    }
  }

  /**
   * List all sessions (run_ids) with their time ranges.
   * Optionally filtered to a time window.
   */
  async listSessions(timeRange?: TimeRange): Promise<AdapterSessionInfo[]> {
    const db = this.openDb();
    try {
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (timeRange?.after) {
        conditions.push('MAX(created_at) >= ?');
        params.push(timeRange.after);
      }
      if (timeRange?.before) {
        conditions.push('MIN(created_at) <= ?');
        params.push(timeRange.before);
      }

      const having = conditions.length > 0
        ? `HAVING ${conditions.join(' AND ')}`
        : '';

      const sql = `
        SELECT
          run_id,
          MIN(created_at) AS started_at,
          MAX(created_at) AS ended_at
        FROM batons
        GROUP BY run_id
        ${having}
        ORDER BY started_at DESC`;

      const rows = db.prepare(sql).all(...params) as SessionAggregateRow[];

      return rows.map(row => ({
        sessionId: row.run_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      }));
    } finally {
      db.close();
    }
  }
}
