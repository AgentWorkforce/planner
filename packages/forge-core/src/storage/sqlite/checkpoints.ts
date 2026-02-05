import type Database from 'better-sqlite3';
import type { Checkpoint } from '../../domain/types.js';
import { type CheckpointRow, rowToCheckpoint } from './converters.js';

export function createCheckpoint(db: Database.Database, checkpoint: Checkpoint): Checkpoint {
  const stmt = db.prepare(`
    INSERT INTO checkpoints (
      checkpoint_id, run_id, run_status, has_pending_gate,
      tasks_snapshot, active_agents, snapshot, created_at
    )
    VALUES (
      @checkpoint_id, @run_id, @run_status, @has_pending_gate,
      @tasks_snapshot, @active_agents, @snapshot, @created_at
    )
  `);
  stmt.run({
    checkpoint_id: checkpoint.checkpoint_id,
    run_id: checkpoint.run_id,
    run_status: checkpoint.run_status,
    has_pending_gate: checkpoint.has_pending_gate ? 1 : 0,
    tasks_snapshot: JSON.stringify(checkpoint.tasks_snapshot),
    active_agents: JSON.stringify(checkpoint.active_agents),
    snapshot: JSON.stringify(checkpoint.snapshot),
    created_at: checkpoint.created_at,
  });
  return checkpoint;
}

export function getLatestCheckpoint(db: Database.Database, runId: string): Checkpoint | null {
  const stmt = db.prepare<string, CheckpointRow>(`
    SELECT checkpoint_id, run_id, run_status, has_pending_gate,
           tasks_snapshot, active_agents, snapshot, created_at
    FROM checkpoints
    WHERE run_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = stmt.get(runId);
  if (!row) return null;
  return rowToCheckpoint(row);
}

export function listCheckpoints(db: Database.Database, runId: string): Checkpoint[] {
  const stmt = db.prepare<string, CheckpointRow>(`
    SELECT checkpoint_id, run_id, run_status, has_pending_gate,
           tasks_snapshot, active_agents, snapshot, created_at
    FROM checkpoints
    WHERE run_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToCheckpoint(row));
}
