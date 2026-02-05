/**
 * SQLite Storage Implementation for Ideation
 *
 * Persists Sessions using better-sqlite3.
 * No Nugget entity - understanding is live state.
 */

import { BaseSqliteStorage } from '@plannr/storage-base';
import { randomUUID } from 'crypto';
import type { IdeationStorage } from './interface.js';
import type {
  Session,
  SessionStatus,
  TranscriptMessage,
  ActiveSpecialist,
  PlannerSend,
  SessionSource,
  Understanding,
  Block,
} from '../domain/index.js';

// =============================================================================
// Row Types
// =============================================================================

interface SessionRow {
  id: string;
  status: string;
  initiative_id: string | null;
  source: string;
  transcript: string;
  understanding: string;
  active_specialists: string;
  planner_sends: string;
  blocks: string;
  created_at: string;
  updated_at: string;
  // V3-prep: Handoff tracking
  last_handoff_at: string | null;
  last_handoff_plan_id: string | null;
  last_handoff_version_id: number | null;
  // V3-prep: Synthesized understanding
  synthesized: string | null;
}

// =============================================================================
// SQLite Implementation
// =============================================================================

export class SQLiteIdeationStorage extends BaseSqliteStorage implements IdeationStorage {
  constructor(dbPath: string = ':memory:') {
    super(dbPath);
  }

  /**
   * Base class abstract method - no-op for ideation since we use async initialize()
   * The actual schema setup happens in the async initialize() method below.
   */
  protected initializeSchema(): void {
    // No-op: ideation uses async initialize() called externally after construction
  }

  /**
   * Initialize database schema asynchronously.
   * Must be called after construction.
   */
  async initialize(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ideation_sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        initiative_id TEXT,
        source TEXT NOT NULL,
        transcript TEXT NOT NULL DEFAULT '[]',
        understanding TEXT NOT NULL DEFAULT '{}',
        active_specialists TEXT NOT NULL DEFAULT '[]',
        planner_sends TEXT NOT NULL DEFAULT '[]',
        blocks TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ideation_sessions_status
        ON ideation_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_ideation_sessions_initiative
        ON ideation_sessions(initiative_id);
      CREATE INDEX IF NOT EXISTS idx_ideation_sessions_updated
        ON ideation_sessions(updated_at DESC);
    `);

    // Migration: Add blocks column to existing tables
    // This is idempotent - safe to run multiple times
    try {
      this.db.exec(`
        ALTER TABLE ideation_sessions
        ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]';
      `);
    } catch (e) {
      // Column already exists, ignore error
      if (!(e instanceof Error && e.message.includes('duplicate column'))) {
        throw e;
      }
    }

    // Migration: Add V3-prep handoff tracking columns
    // These mirror planner_sends[-1] for quick banner logic
    try {
      this.db.exec(`
        ALTER TABLE ideation_sessions
        ADD COLUMN last_handoff_at TEXT;
      `);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes('duplicate column'))) {
        throw e;
      }
    }

    try {
      this.db.exec(`
        ALTER TABLE ideation_sessions
        ADD COLUMN last_handoff_plan_id TEXT;
      `);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes('duplicate column'))) {
        throw e;
      }
    }

    try {
      this.db.exec(`
        ALTER TABLE ideation_sessions
        ADD COLUMN last_handoff_version_id INTEGER;
      `);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes('duplicate column'))) {
        throw e;
      }
    }

    // Migration: Add V3-prep synthesized understanding column
    try {
      this.db.exec(`
        ALTER TABLE ideation_sessions
        ADD COLUMN synthesized TEXT;
      `);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes('duplicate column'))) {
        throw e;
      }
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // ==========================================================================
  // Session CRUD Operations (#99)
  // ==========================================================================

  async createSession(source: SessionSource, initiative_id?: string): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      status: 'active',
      initiative_id,
      source,
      transcript: [],
      understanding: {},
      active_specialists: [],
      planner_sends: [],
      blocks: [],
      created_at: now,
      updated_at: now,
      // V3-prep fields - undefined until handoff/synthesis
      lastHandoffAt: undefined,
      lastHandoffPlanId: undefined,
      lastHandoffVersionId: undefined,
      synthesized: undefined,
    };

    this.db
      .prepare(
        `INSERT INTO ideation_sessions
         (id, status, initiative_id, source, transcript, understanding,
          active_specialists, planner_sends, blocks, created_at, updated_at,
          last_handoff_at, last_handoff_plan_id, last_handoff_version_id, synthesized)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.status,
        session.initiative_id ?? null,
        JSON.stringify(session.source),
        JSON.stringify(session.transcript),
        JSON.stringify(session.understanding),
        JSON.stringify(session.active_specialists),
        JSON.stringify(session.planner_sends),
        JSON.stringify(session.blocks),
        session.created_at,
        session.updated_at,
        session.lastHandoffAt ?? null,
        session.lastHandoffPlanId ?? null,
        session.lastHandoffVersionId ?? null,
        session.synthesized ? JSON.stringify(session.synthesized) : null
      );

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    const row = this.db
      .prepare('SELECT * FROM ideation_sessions WHERE id = ?')
      .get(id) as SessionRow | undefined;

    if (!row) return null;
    return this.rowToSession(row);
  }

  async listSessions(filter?: {
    status?: SessionStatus;
    initiative_id?: string;
  }): Promise<Session[]> {
    let query = 'SELECT * FROM ideation_sessions WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.initiative_id) {
      query += ' AND initiative_id = ?';
      params.push(filter.initiative_id);
    }

    query += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(query).all(...params) as SessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  async updateSessionStatus(id: string, status: SessionStatus): Promise<Session> {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE ideation_sessions SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id);

    if (result.changes === 0) {
      throw new Error(`Session not found: ${id}`);
    }

    const session = await this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    return session;
  }

  async updateSession(id: string, updates: { title?: string }): Promise<Session> {
    const now = new Date().toISOString();

    // Get current session to update source object
    const session = await this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    // Update source.initial_intent if title is provided
    if (updates.title !== undefined) {
      const updatedSource = {
        ...session.source,
        initial_intent: updates.title,
      };

      const result = this.db
        .prepare('UPDATE ideation_sessions SET source = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updatedSource), now, id);

      if (result.changes === 0) {
        throw new Error(`Session not found: ${id}`);
      }
    }

    // Fetch and return updated session
    const updatedSession = await this.getSession(id);
    if (!updatedSession) {
      throw new Error(`Session not found: ${id}`);
    }
    return updatedSession;
  }

  // ==========================================================================
  // Transcript Append (#100)
  // ==========================================================================

  async appendTranscript(sessionId: string, message: TranscriptMessage): Promise<Session> {
    const now = new Date().toISOString();

    // Use SQLite JSON functions to append efficiently
    const result = this.db
      .prepare(`
        UPDATE ideation_sessions
        SET transcript = json_insert(transcript, '$[#]', json(?)),
            updated_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(message), now, sessionId);

    if (result.changes === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  // ==========================================================================
  // Understanding Update (#101)
  // ==========================================================================

  async updateUnderstanding(
    sessionId: string,
    specialistName: string,
    observations: Record<string, unknown>
  ): Promise<Session> {
    const now = new Date().toISOString();

    // Use SQLite JSON functions to set specific specialist key
    // json_set replaces or creates the key without affecting others
    const result = this.db
      .prepare(`
        UPDATE ideation_sessions
        SET understanding = json_set(understanding, '$.' || ?, json(?)),
            updated_at = ?
        WHERE id = ?
      `)
      .run(specialistName, JSON.stringify(observations), now, sessionId);

    if (result.changes === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  // ==========================================================================
  // Active Specialists Operations (#102)
  // ==========================================================================

  async addActiveSpecialist(sessionId: string, specialist: ActiveSpecialist): Promise<Session> {
    const now = new Date().toISOString();

    // Append specialist to array
    const result = this.db
      .prepare(`
        UPDATE ideation_sessions
        SET active_specialists = json_insert(active_specialists, '$[#]', json(?)),
            updated_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(specialist), now, sessionId);

    if (result.changes === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  async removeActiveSpecialist(sessionId: string, specialistName: string): Promise<Session> {
    const now = new Date().toISOString();

    // Get current session to filter specialists
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const filtered = session.active_specialists.filter(s => s.name !== specialistName);

    this.db
      .prepare(`
        UPDATE ideation_sessions
        SET active_specialists = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(filtered), now, sessionId);

    return {
      ...session,
      active_specialists: filtered,
      updated_at: now,
    };
  }

  // ==========================================================================
  // Planner Send Append (#103)
  // ==========================================================================

  async appendPlannerSend(sessionId: string, send: PlannerSend): Promise<Session> {
    const now = new Date().toISOString();

    // Append to planner_sends array AND update handoff tracking fields
    const result = this.db
      .prepare(`
        UPDATE ideation_sessions
        SET planner_sends = json_insert(planner_sends, '$[#]', json(?)),
            last_handoff_at = ?,
            last_handoff_plan_id = ?,
            last_handoff_version_id = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        JSON.stringify(send),
        send.sent_at,
        send.result.plan_id,
        send.result.plan_version,
        now,
        sessionId
      );

    if (result.changes === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  // ==========================================================================
  // Block Operations (#cv2-012)
  // ==========================================================================

  async updateBlocks(sessionId: string, blocks: Block[]): Promise<Session> {
    const now = new Date().toISOString();

    // Replace entire blocks array
    const result = this.db
      .prepare(`
        UPDATE ideation_sessions
        SET blocks = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(blocks), now, sessionId);

    if (result.changes === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  // ==========================================================================
  // Synthesis Update (#cv2-060)
  // ==========================================================================

  async updateSynthesis(
    sessionId: string,
    synthesis: {
      idea_summary: string;
      specialist_perspectives: Record<string, {
        take: string;
        concerns: string[];
        confidence: 'exploring' | 'forming' | 'confident';
      }>;
    }
  ): Promise<Session> {
    const now = new Date().toISOString();

    // Update synthesized field
    const result = this.db
      .prepare(`
        UPDATE ideation_sessions
        SET synthesized = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(synthesis), now, sessionId);

    if (result.changes === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      status: row.status as SessionStatus,
      initiative_id: row.initiative_id ?? undefined,
      source: JSON.parse(row.source) as SessionSource,
      transcript: JSON.parse(row.transcript) as TranscriptMessage[],
      understanding: JSON.parse(row.understanding) as Understanding,
      active_specialists: JSON.parse(row.active_specialists) as ActiveSpecialist[],
      planner_sends: JSON.parse(row.planner_sends) as PlannerSend[],
      blocks: JSON.parse(row.blocks || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at,
      // V3-prep fields
      lastHandoffAt: row.last_handoff_at ?? undefined,
      lastHandoffPlanId: row.last_handoff_plan_id ?? undefined,
      lastHandoffVersionId: row.last_handoff_version_id ?? undefined,
      synthesized: row.synthesized ? JSON.parse(row.synthesized) : undefined,
    };
  }
}
