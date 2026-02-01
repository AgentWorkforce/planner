/**
 * SQLite Storage Implementation for Ideation
 *
 * Persists Sessions and Nuggets using better-sqlite3.
 * Follows the same patterns as planner-core storage.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { IdeationStorage } from './interface.js';
import type {
  Session,
  SessionStatus,
  Nugget,
  TranscriptMessage,
  AgentObservations,
  CreateSessionRequest,
  CrystallizeRequest,
  Understanding,
  SessionSource,
} from '../domain/index.js';

export class SQLiteIdeationStorage implements IdeationStorage {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  async initialize(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        source TEXT NOT NULL,
        initial_intent TEXT NOT NULL,
        transcript TEXT NOT NULL DEFAULT '[]',
        understanding TEXT NOT NULL DEFAULT '{}',
        nugget_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nuggets (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        context TEXT,
        constraints TEXT,
        understanding TEXT NOT NULL,
        initial_specification TEXT,
        plan_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_nuggets_session ON nuggets(session_id);
    `);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // ==========================================================================
  // Session Operations
  // ==========================================================================

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      status: 'active',
      source: request.source ?? { type: 'human_initiated' },
      initial_intent: request.initial_intent,
      transcript: [],
      understanding: {},
      nugget_id: null,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO sessions (id, status, source, initial_intent, transcript, understanding, nugget_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.status,
        JSON.stringify(session.source),
        session.initial_intent,
        JSON.stringify(session.transcript),
        JSON.stringify(session.understanding),
        session.nugget_id,
        session.created_at,
        session.updated_at
      );

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    if (!row) return null;
    return this.rowToSession(row);
  }

  async listSessions(options?: {
    status?: SessionStatus;
    limit?: number;
    offset?: number;
  }): Promise<Session[]> {
    let query = 'SELECT * FROM sessions';
    const params: unknown[] = [];

    if (options?.status) {
      query += ' WHERE status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(query).all(...params) as SessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  async updateSessionStatus(id: string, status: SessionStatus): Promise<Session> {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
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

  async appendMessage(
    sessionId: string,
    message: Omit<TranscriptMessage, 'timestamp'>
  ): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const fullMessage: TranscriptMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    const transcript = [...session.transcript, fullMessage];
    const now = new Date().toISOString();

    this.db
      .prepare('UPDATE sessions SET transcript = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(transcript), now, sessionId);

    return {
      ...session,
      transcript,
      updated_at: now,
    };
  }

  async updateObservations(
    sessionId: string,
    role: string,
    observations: AgentObservations
  ): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const understanding: Understanding = {
      ...session.understanding,
      [role]: {
        ...observations,
        updated_at: new Date().toISOString(),
      },
    };

    const now = new Date().toISOString();

    this.db
      .prepare('UPDATE sessions SET understanding = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(understanding), now, sessionId);

    return {
      ...session,
      understanding,
      updated_at: now,
    };
  }

  async deleteSession(id: string): Promise<void> {
    // Delete nugget first if exists
    this.db.prepare('DELETE FROM nuggets WHERE session_id = ?').run(id);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // ==========================================================================
  // Nugget Operations
  // ==========================================================================

  async crystallizeSession(sessionId: string, request: CrystallizeRequest): Promise<Nugget> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'active') {
      throw new Error(`Session is not active: ${sessionId} (status: ${session.status})`);
    }

    const now = new Date().toISOString();
    const nugget: Nugget = {
      id: randomUUID(),
      session_id: sessionId,
      goal: request.goal,
      context: request.context,
      constraints: request.constraints,
      understanding: session.understanding,
      initial_specification: request.initial_specification,
      plan_id: null,
      created_at: now,
      updated_at: now,
    };

    // Transaction: create nugget and update session
    const insertNugget = this.db.prepare(
      `INSERT INTO nuggets (id, session_id, goal, context, constraints, understanding, initial_specification, plan_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const updateSession = this.db.prepare(
      `UPDATE sessions SET status = 'crystallized', nugget_id = ?, updated_at = ? WHERE id = ?`
    );

    const transaction = this.db.transaction(() => {
      insertNugget.run(
        nugget.id,
        nugget.session_id,
        nugget.goal,
        nugget.context ?? null,
        nugget.constraints ? JSON.stringify(nugget.constraints) : null,
        JSON.stringify(nugget.understanding),
        nugget.initial_specification ? JSON.stringify(nugget.initial_specification) : null,
        nugget.plan_id,
        nugget.created_at,
        nugget.updated_at
      );
      updateSession.run(nugget.id, now, sessionId);
    });

    transaction();

    return nugget;
  }

  async getNugget(id: string): Promise<Nugget | null> {
    const row = this.db.prepare('SELECT * FROM nuggets WHERE id = ?').get(id) as NuggetRow | undefined;
    if (!row) return null;
    return this.rowToNugget(row);
  }

  async getNuggetBySession(sessionId: string): Promise<Nugget | null> {
    const row = this.db
      .prepare('SELECT * FROM nuggets WHERE session_id = ?')
      .get(sessionId) as NuggetRow | undefined;
    if (!row) return null;
    return this.rowToNugget(row);
  }

  async promoteNugget(nuggetId: string, planId: string): Promise<Nugget> {
    const nugget = await this.getNugget(nuggetId);
    if (!nugget) {
      throw new Error(`Nugget not found: ${nuggetId}`);
    }

    const now = new Date().toISOString();

    // Transaction: update nugget and session
    const updateNugget = this.db.prepare(
      `UPDATE nuggets SET plan_id = ?, updated_at = ? WHERE id = ?`
    );

    const updateSession = this.db.prepare(
      `UPDATE sessions SET status = 'promoted', updated_at = ? WHERE id = ?`
    );

    const transaction = this.db.transaction(() => {
      updateNugget.run(planId, now, nuggetId);
      updateSession.run(now, nugget.session_id);
    });

    transaction();

    return {
      ...nugget,
      plan_id: planId,
      updated_at: now,
    };
  }

  async listNuggets(options?: { limit?: number; offset?: number }): Promise<Nugget[]> {
    let query = 'SELECT * FROM nuggets ORDER BY created_at DESC';
    const params: unknown[] = [];

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(query).all(...params) as NuggetRow[];
    return rows.map((row) => this.rowToNugget(row));
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      status: row.status as SessionStatus,
      source: JSON.parse(row.source) as SessionSource,
      initial_intent: row.initial_intent,
      transcript: JSON.parse(row.transcript) as TranscriptMessage[],
      understanding: JSON.parse(row.understanding) as Understanding,
      nugget_id: row.nugget_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToNugget(row: NuggetRow): Nugget {
    return {
      id: row.id,
      session_id: row.session_id,
      goal: row.goal,
      context: row.context ?? undefined,
      constraints: row.constraints ? JSON.parse(row.constraints) : undefined,
      understanding: JSON.parse(row.understanding) as Understanding,
      initial_specification: row.initial_specification
        ? JSON.parse(row.initial_specification)
        : undefined,
      plan_id: row.plan_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// Row types for type safety
interface SessionRow {
  id: string;
  status: string;
  source: string;
  initial_intent: string;
  transcript: string;
  understanding: string;
  nugget_id: string | null;
  created_at: string;
  updated_at: string;
}

interface NuggetRow {
  id: string;
  session_id: string;
  goal: string;
  context: string | null;
  constraints: string | null;
  understanding: string;
  initial_specification: string | null;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}
