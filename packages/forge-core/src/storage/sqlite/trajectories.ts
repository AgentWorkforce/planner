import type Database from 'better-sqlite3';
import type { TrajectoryEvent } from '../../domain/types.js';
import type { TrajectoryEventFilter } from '../interface.js';
import { type TrajectoryEventRow, rowToTrajectoryEvent } from './converters.js';

export function createTrajectoryEvent(db: Database.Database, event: TrajectoryEvent): TrajectoryEvent {
  const stmt = db.prepare(`
    INSERT INTO trajectory_events (
      event_id, run_id, task_id, event_type, payload, timestamp
    )
    VALUES (
      @event_id, @run_id, @task_id, @event_type, @payload, @timestamp
    )
  `);
  stmt.run({
    event_id: event.event_id,
    run_id: event.run_id,
    task_id: event.task_id ?? null,
    event_type: event.event_type,
    payload: JSON.stringify(event.payload),
    timestamp: event.timestamp,
  });
  return event;
}

export function listTrajectoryEvents(
  db: Database.Database,
  runId: string,
  filter?: TrajectoryEventFilter
): TrajectoryEvent[] {
  let sql = `
    SELECT event_id, run_id, task_id, event_type, payload, timestamp
    FROM trajectory_events
    WHERE run_id = ?
  `;
  const params: unknown[] = [runId];

  if (filter?.task_id) {
    sql += ' AND task_id = ?';
    params.push(filter.task_id);
  }
  if (filter?.event_type) {
    sql += ' AND event_type = ?';
    params.push(filter.event_type);
  }
  if (filter?.from_timestamp) {
    sql += ' AND timestamp >= ?';
    params.push(filter.from_timestamp);
  }
  if (filter?.to_timestamp) {
    sql += ' AND timestamp <= ?';
    params.push(filter.to_timestamp);
  }

  sql += ' ORDER BY timestamp DESC';

  const stmt = db.prepare<unknown[], TrajectoryEventRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToTrajectoryEvent(row));
}

export function deleteTrajectoryEventsOlderThan(db: Database.Database, timestamp: string): number {
  const stmt = db.prepare(`
    DELETE FROM trajectory_events
    WHERE timestamp < ?
  `);
  const result = stmt.run(timestamp);
  return result.changes;
}

export function deleteTrajectoryEventsByRunId(db: Database.Database, runId: string): number {
  const stmt = db.prepare(`
    DELETE FROM trajectory_events
    WHERE run_id = ?
  `);
  const result = stmt.run(runId);
  return result.changes;
}

export function countTrajectoryEvents(db: Database.Database, runId: string): number {
  const stmt = db.prepare<string, { count: number }>(`
    SELECT COUNT(*) as count
    FROM trajectory_events
    WHERE run_id = ?
  `);
  const row = stmt.get(runId);
  return row?.count ?? 0;
}
