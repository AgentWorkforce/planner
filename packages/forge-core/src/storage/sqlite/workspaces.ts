import type Database from 'better-sqlite3';
import type { WorkspaceCleanup } from '../../domain/types.js';
import type { WorkspaceCleanupRow } from './converters.js';

export function scheduleCleanup(db: Database.Database, taskId: string, cleanupAfter: string): WorkspaceCleanup {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO workspace_cleanup (task_id, cleanup_after)
    VALUES (@task_id, @cleanup_after)
  `);
  stmt.run({ task_id: taskId, cleanup_after: cleanupAfter });
  return { task_id: taskId, cleanup_after: cleanupAfter };
}

export function getExpiredCleanups(db: Database.Database): WorkspaceCleanup[] {
  const now = new Date().toISOString();
  const stmt = db.prepare<string, WorkspaceCleanupRow>(`
    SELECT task_id, cleanup_after
    FROM workspace_cleanup
    WHERE cleanup_after < ?
    ORDER BY cleanup_after ASC
  `);
  const rows = stmt.all(now);
  return rows.map((row) => ({
    task_id: row.task_id,
    cleanup_after: row.cleanup_after,
  }));
}

export function deleteCleanup(db: Database.Database, taskId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM workspace_cleanup
    WHERE task_id = ?
  `);
  const result = stmt.run(taskId);
  return result.changes > 0;
}
