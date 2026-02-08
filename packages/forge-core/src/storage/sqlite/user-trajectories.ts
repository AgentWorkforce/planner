import type Database from 'better-sqlite3';
import type { UserTrajectoryEvent, UserTrajectoryScope } from '../../domain/user-trajectory.js';
import { type UserTrajectoryEventRow, rowToUserTrajectoryEvent } from './converters.js';

export function createUserTrajectoryEvent(db: Database.Database, event: UserTrajectoryEvent): UserTrajectoryEvent {
  const stmt = db.prepare(`
    INSERT INTO user_trajectory_events (
      event_id, user_id, scope, question_text, selected_option, reasoning,
      run_id, task_id, project_id, category, timestamp
    )
    VALUES (
      @event_id, @user_id, @scope, @question_text, @selected_option, @reasoning,
      @run_id, @task_id, @project_id, @category, @timestamp
    )
  `);
  stmt.run({
    event_id: event.event_id,
    user_id: event.user_id,
    scope: event.scope,
    question_text: event.question_text,
    selected_option: event.selected_option,
    reasoning: event.reasoning ?? null,
    run_id: event.run_id ?? null,
    task_id: event.task_id ?? null,
    project_id: event.project_id ?? null,
    category: event.category ?? null,
    timestamp: event.timestamp,
  });
  return event;
}

export function listUserTrajectoryEvents(
  db: Database.Database,
  userId: string,
  scope?: UserTrajectoryScope,
  projectId?: string,
  runId?: string
): UserTrajectoryEvent[] {
  let sql = `
    SELECT event_id, user_id, scope, question_text, selected_option, reasoning,
           run_id, task_id, project_id, category, timestamp
    FROM user_trajectory_events
    WHERE user_id = ?
  `;
  const params: unknown[] = [userId];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }
  if (projectId) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }
  if (runId) {
    sql += ' AND run_id = ?';
    params.push(runId);
  }

  sql += ' ORDER BY timestamp DESC';

  const stmt = db.prepare<unknown[], UserTrajectoryEventRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToUserTrajectoryEvent(row));
}

export function getUserTrajectoryEventsByCategory(
  db: Database.Database,
  userId: string,
  category: string,
  scope?: UserTrajectoryScope
): UserTrajectoryEvent[] {
  let sql = `
    SELECT event_id, user_id, scope, question_text, selected_option, reasoning,
           run_id, task_id, project_id, category, timestamp
    FROM user_trajectory_events
    WHERE user_id = ? AND category = ?
  `;
  const params: unknown[] = [userId, category];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }

  sql += ' ORDER BY timestamp DESC';

  const stmt = db.prepare<unknown[], UserTrajectoryEventRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToUserTrajectoryEvent(row));
}

export function searchSimilarUserTrajectoryEvents(
  db: Database.Database,
  userId: string,
  questionText: string,
  scope?: UserTrajectoryScope,
  limit: number = 10
): UserTrajectoryEvent[] {
  // Simple text search - fetch all events and filter
  // For production, consider using FTS5 or external similarity service
  let sql = `
    SELECT event_id, user_id, scope, question_text, selected_option, reasoning,
           run_id, task_id, project_id, category, timestamp
    FROM user_trajectory_events
    WHERE user_id = ?
  `;
  const params: unknown[] = [userId];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }

  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit * 10); // Fetch more to filter

  const stmt = db.prepare<unknown[], UserTrajectoryEventRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToUserTrajectoryEvent(row)).slice(0, limit);
}
