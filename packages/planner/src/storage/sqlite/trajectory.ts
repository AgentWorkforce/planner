import type Database from 'better-sqlite3';
import type { DecisionEvent, TrajectoryEventFilter } from '../../domain/trajectory.js';
import { rowToTrajectoryEvent } from './converters.js';
import type { TrajectoryEventRow } from './converters.js';

// ============================================
// Trajectory operations
// ============================================

export function createTrajectoryEvent(db: Database.Database, event: DecisionEvent): DecisionEvent {
  const stmt = db.prepare(`
    INSERT INTO trajectory_events (
      event_id, type, question_id, asking_agent, question_text,
      context_provided, options_presented_json, selected_option,
      free_text_response, reasoning, plan_id, step_id,
      agent_trajectory_ref, timestamp
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    event.event_id,
    event.type,
    event.question_id,
    event.asking_agent,
    event.question_text,
    event.context_provided ?? null,
    JSON.stringify(event.options_presented),
    event.selected_option ?? null,
    event.free_text_response ?? null,
    event.reasoning ?? null,
    event.plan_id,
    event.step_id ?? null,
    event.agent_trajectory_ref ?? null,
    event.timestamp
  );

  return event;
}

export function getTrajectoryEvent(db: Database.Database, eventId: string): DecisionEvent | null {
  const stmt = db.prepare(`
    SELECT * FROM trajectory_events
    WHERE event_id = ?
  `);
  const row = stmt.get(eventId) as TrajectoryEventRow | undefined;
  return row ? rowToTrajectoryEvent(row) : null;
}

export function listTrajectoryEvents(
  db: Database.Database,
  planId: string,
  filter?: TrajectoryEventFilter
): DecisionEvent[] {
  let query = `
    SELECT * FROM trajectory_events
    WHERE plan_id = ?
  `;
  const params: unknown[] = [planId];

  if (filter?.agent_id) {
    query += ` AND asking_agent = ?`;
    params.push(filter.agent_id);
  }

  if (filter?.event_type) {
    query += ` AND type = ?`;
    params.push(filter.event_type);
  }

  if (filter?.step_id) {
    query += ` AND step_id = ?`;
    params.push(filter.step_id);
  }

  if (filter?.from_date) {
    query += ` AND timestamp >= ?`;
    params.push(filter.from_date);
  }

  if (filter?.to_date) {
    query += ` AND timestamp <= ?`;
    params.push(filter.to_date);
  }

  query += ` ORDER BY timestamp DESC`;

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as TrajectoryEventRow[];
  return rows.map((row) => rowToTrajectoryEvent(row));
}

export function findSimilarQuestions(
  db: Database.Database,
  planId: string,
  text: string,
  threshold: number = 0.7
): DecisionEvent[] {
  // Simple text similarity using word matching
  // For v1, we use a basic keyword-based similarity check
  // In production, you might want to use a more sophisticated similarity metric

  // Extract significant words (> 3 chars) from the query
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5); // Use top 5 words

  if (words.length === 0) {
    return [];
  }

  // Build a query that matches any of the keywords
  const conditions = words.map(() => 'LOWER(question_text) LIKE ?').join(' OR ');
  const params = [planId, ...words.map(w => `%${w}%`)];

  const stmt = db.prepare(`
    SELECT * FROM trajectory_events
    WHERE plan_id = ?
      AND (${conditions})
    ORDER BY timestamp DESC
    LIMIT 10
  `);

  const rows = stmt.all(...params) as TrajectoryEventRow[];
  return rows.map((row) => rowToTrajectoryEvent(row));
}

export function deleteTrajectoryEvent(db: Database.Database, eventId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM trajectory_events
    WHERE event_id = ?
  `);
  const result = stmt.run(eventId);
  return result.changes > 0;
}
