import type Database from 'better-sqlite3';
import type {
  GuardianEvent,
  GuardianConcernLevel,
  ActiveGuardian,
  GuardianStatus,
} from '../../domain/types.js';
import type { GuardianEventFilter } from '../interface.js';
import {
  type GuardianEventRow,
  type ActiveGuardianRow,
  rowToGuardianEvent,
  rowToActiveGuardian,
} from './converters.js';

export function createGuardianEvent(db: Database.Database, event: GuardianEvent): GuardianEvent {
  const stmt = db.prepare(`
    INSERT INTO guardian_trajectories (
      event_id, project_id, guardian_type, observation, concern_level,
      recommendation, timestamp, run_id, task_id, worker_agent_id,
      trigger_type, intervention_taken
    )
    VALUES (
      @event_id, @project_id, @guardian_type, @observation, @concern_level,
      @recommendation, @timestamp, @run_id, @task_id, @worker_agent_id,
      @trigger_type, @intervention_taken
    )
  `);
  stmt.run({
    event_id: event.event_id,
    project_id: event.project_id,
    guardian_type: event.guardian_type,
    observation: event.observation,
    concern_level: event.concern_level,
    recommendation: event.recommendation ?? null,
    timestamp: event.timestamp,
    run_id: event.run_id ?? null,
    task_id: event.task_id ?? null,
    worker_agent_id: event.worker_agent_id ?? null,
    trigger_type: event.trigger_type ?? null,
    intervention_taken: event.intervention_taken ?? null,
  });
  return event;
}

export function listGuardianEvents(
  db: Database.Database,
  projectId: string,
  filter?: GuardianEventFilter
): GuardianEvent[] {
  let sql = `
    SELECT event_id, project_id, guardian_type, observation, concern_level,
           recommendation, timestamp, run_id, task_id, worker_agent_id,
           trigger_type, intervention_taken
    FROM guardian_trajectories
    WHERE project_id = ?
  `;
  const params: unknown[] = [projectId];

  if (filter?.guardian_type) {
    sql += ' AND guardian_type = ?';
    params.push(filter.guardian_type);
  }
  if (filter?.concern_level) {
    sql += ' AND concern_level = ?';
    params.push(filter.concern_level);
  }
  if (filter?.from_timestamp) {
    sql += ' AND timestamp >= ?';
    params.push(filter.from_timestamp);
  }
  if (filter?.to_timestamp) {
    sql += ' AND timestamp <= ?';
    params.push(filter.to_timestamp);
  }
  if (filter?.run_id) {
    sql += ' AND run_id = ?';
    params.push(filter.run_id);
  }
  if (filter?.task_id) {
    sql += ' AND task_id = ?';
    params.push(filter.task_id);
  }

  sql += ' ORDER BY timestamp DESC';

  const stmt = db.prepare<unknown[], GuardianEventRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToGuardianEvent(row));
}

export function getGuardianEventsByType(
  db: Database.Database,
  projectId: string,
  guardianType: 'Security' | 'Architect' | 'QA' | 'Compliance'
): GuardianEvent[] {
  const stmt = db.prepare<[string, string], GuardianEventRow>(`
    SELECT event_id, project_id, guardian_type, observation, concern_level,
           recommendation, timestamp, run_id, task_id, worker_agent_id,
           trigger_type, intervention_taken
    FROM guardian_trajectories
    WHERE project_id = ? AND guardian_type = ?
    ORDER BY timestamp DESC
  `);
  const rows = stmt.all(projectId, guardianType);
  return rows.map((row) => rowToGuardianEvent(row));
}

export function countGuardianEventsByConcernLevel(
  db: Database.Database,
  projectId: string
): Record<GuardianConcernLevel, number> {
  const stmt = db.prepare<string, { concern_level: string; count: number }>(`
    SELECT concern_level, COUNT(*) as count
    FROM guardian_trajectories
    WHERE project_id = ?
    GROUP BY concern_level
  `);
  const rows = stmt.all(projectId);

  const result: Record<GuardianConcernLevel, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  };

  for (const row of rows) {
    if (row.concern_level in result) {
      result[row.concern_level as GuardianConcernLevel] = row.count;
    }
  }

  return result;
}

export function deleteGuardianEventsOlderThan(db: Database.Database, timestamp: string): number {
  const stmt = db.prepare(`
    DELETE FROM guardian_trajectories
    WHERE timestamp < ?
  `);
  const result = stmt.run(timestamp);
  return result.changes;
}

export function createActiveGuardian(db: Database.Database, guardian: ActiveGuardian): ActiveGuardian {
  const stmt = db.prepare(`
    INSERT INTO active_guardians (
      guardian_id, project_id, guardian_type, agent_name, status,
      shadow_targets, speak_on, spawned_at, stopped_at, error
    )
    VALUES (
      @guardian_id, @project_id, @guardian_type, @agent_name, @status,
      @shadow_targets, @speak_on, @spawned_at, @stopped_at, @error
    )
  `);
  stmt.run({
    guardian_id: guardian.guardian_id,
    project_id: guardian.project_id,
    guardian_type: guardian.guardian_type,
    agent_name: guardian.agent_name,
    status: guardian.status,
    shadow_targets: JSON.stringify(guardian.shadow_targets),
    speak_on: JSON.stringify(guardian.speak_on),
    spawned_at: guardian.spawned_at,
    stopped_at: guardian.stopped_at ?? null,
    error: guardian.error ?? null,
  });
  return guardian;
}

export function getActiveGuardian(db: Database.Database, guardianId: string): ActiveGuardian | null {
  const stmt = db.prepare<string, ActiveGuardianRow>(`
    SELECT guardian_id, project_id, guardian_type, agent_name, status,
           shadow_targets, speak_on, spawned_at, stopped_at, error
    FROM active_guardians
    WHERE guardian_id = ?
  `);
  const row = stmt.get(guardianId);
  if (!row) return null;
  return rowToActiveGuardian(row);
}

export function updateActiveGuardian(
  db: Database.Database,
  guardianId: string,
  updates: Partial<ActiveGuardian>
): ActiveGuardian | null {
  const fields: string[] = [];
  const values: Record<string, unknown> = { guardian_id: guardianId };

  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.shadow_targets !== undefined) {
    fields.push('shadow_targets = @shadow_targets');
    values.shadow_targets = JSON.stringify(updates.shadow_targets);
  }
  if (updates.speak_on !== undefined) {
    fields.push('speak_on = @speak_on');
    values.speak_on = JSON.stringify(updates.speak_on);
  }
  if (updates.stopped_at !== undefined) {
    fields.push('stopped_at = @stopped_at');
    values.stopped_at = updates.stopped_at ?? null;
  }
  if (updates.error !== undefined) {
    fields.push('error = @error');
    values.error = updates.error ?? null;
  }

  if (fields.length === 0) {
    return getActiveGuardian(db, guardianId);
  }

  const stmt = db.prepare(`
    UPDATE active_guardians
    SET ${fields.join(', ')}
    WHERE guardian_id = @guardian_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getActiveGuardian(db, guardianId);
}

export function listActiveGuardians(
  db: Database.Database,
  projectId: string,
  status?: GuardianStatus
): ActiveGuardian[] {
  let sql = `
    SELECT guardian_id, project_id, guardian_type, agent_name, status,
           shadow_targets, speak_on, spawned_at, stopped_at, error
    FROM active_guardians
    WHERE project_id = ?
  `;
  const params: unknown[] = [projectId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY spawned_at DESC';

  const stmt = db.prepare<unknown[], ActiveGuardianRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToActiveGuardian(row));
}

export function getAllActiveGuardians(db: Database.Database): ActiveGuardian[] {
  const stmt = db.prepare<[], ActiveGuardianRow>(`
    SELECT guardian_id, project_id, guardian_type, agent_name, status,
           shadow_targets, speak_on, spawned_at, stopped_at, error
    FROM active_guardians
    WHERE status = 'active'
    ORDER BY spawned_at DESC
  `);
  const rows = stmt.all();
  return rows.map((row) => rowToActiveGuardian(row));
}

export function stopGuardian(db: Database.Database, guardianId: string, error?: string): ActiveGuardian | null {
  const now = new Date().toISOString();
  const status = error ? 'error' : 'stopped';
  return updateActiveGuardian(db, guardianId, {
    status: status as GuardianStatus,
    stopped_at: now,
    error,
  });
}
