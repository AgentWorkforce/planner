import type Database from 'better-sqlite3';
import type { Session, SessionStatus } from '../interface.js';
import { rowToSession } from './converters.js';
import type { SessionRow } from './converters.js';

// ============================================
// Session operations
// ============================================

export function createSession(db: Database.Database, session: Session): Session {
  const stmt = db.prepare(`
    INSERT INTO sessions (session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at)
    VALUES (@session_id, @token, @plan_id, @agent_id, @status, @started_at, @ended_at, @expires_at, @created_at)
  `);
  stmt.run({
    session_id: session.session_id,
    token: session.token,
    plan_id: session.plan_id,
    agent_id: session.agent_id,
    status: session.status,
    started_at: session.started_at,
    ended_at: session.ended_at,
    expires_at: session.expires_at,
    created_at: session.created_at,
  });
  return session;
}

export function getSessionByToken(db: Database.Database, token: string): Session | null {
  const stmt = db.prepare<string, SessionRow>(`
    SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
    FROM sessions
    WHERE token = ?
  `);
  const row = stmt.get(token);
  if (!row) return null;
  return rowToSession(row);
}

export function getSessionByPlanId(db: Database.Database, planId: string): Session | null {
  const stmt = db.prepare<string, SessionRow>(`
    SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
    FROM sessions
    WHERE plan_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = stmt.get(planId);
  if (!row) return null;
  return rowToSession(row);
}

export function getActiveSessions(db: Database.Database): Session[] {
  const stmt = db.prepare<[], SessionRow>(`
    SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
    FROM sessions
    WHERE status = 'active'
    ORDER BY created_at ASC
  `);
  const rows = stmt.all();
  return rows.map((row) => rowToSession(row));
}

export function updateSessionStatus(
  db: Database.Database,
  sessionId: string,
  status: SessionStatus
): Session | null {
  const endedAt = status === 'active' ? null : new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE sessions
    SET status = @status, ended_at = @ended_at
    WHERE session_id = @session_id
  `);
  const result = stmt.run({
    session_id: sessionId,
    status,
    ended_at: endedAt,
  });
  if (result.changes === 0) return null;
  return getSessionById(db, sessionId);
}

function getSessionById(db: Database.Database, sessionId: string): Session | null {
  const stmt = db.prepare<string, SessionRow>(`
    SELECT session_id, token, plan_id, agent_id, status, started_at, ended_at, expires_at, created_at
    FROM sessions
    WHERE session_id = ?
  `);
  const row = stmt.get(sessionId);
  if (!row) return null;
  return rowToSession(row);
}

export function deleteSession(db: Database.Database, sessionId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM sessions
    WHERE session_id = ?
  `);
  const result = stmt.run(sessionId);
  return result.changes > 0;
}

export function deleteSessionsByPlan(db: Database.Database, planId: string): number {
  const stmt = db.prepare(`
    DELETE FROM sessions
    WHERE plan_id = ?
  `);
  const result = stmt.run(planId);
  return result.changes;
}
