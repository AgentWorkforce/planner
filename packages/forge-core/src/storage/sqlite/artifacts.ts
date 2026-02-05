import type Database from 'better-sqlite3';
import type { Artifact } from '../../domain/types.js';
import { type ArtifactRow, rowToArtifact } from './converters.js';

export function createArtifact(db: Database.Database, artifact: Artifact): Artifact {
  const stmt = db.prepare(`
    INSERT INTO artifacts (artifact_id, task_id, type, reference, metadata, created_at)
    VALUES (@artifact_id, @task_id, @type, @reference, @metadata, @created_at)
  `);
  stmt.run({
    artifact_id: artifact.artifact_id,
    task_id: artifact.task_id,
    type: artifact.type,
    reference: artifact.reference,
    metadata: artifact.metadata ? JSON.stringify(artifact.metadata) : null,
    created_at: artifact.created_at,
  });
  return artifact;
}

export function listArtifactsByTask(db: Database.Database, taskId: string): Artifact[] {
  const stmt = db.prepare<string, ArtifactRow>(`
    SELECT artifact_id, task_id, type, reference, metadata, created_at
    FROM artifacts
    WHERE task_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(taskId);
  return rows.map((row) => rowToArtifact(row));
}

export function listArtifactsByRun(db: Database.Database, runId: string): Artifact[] {
  const stmt = db.prepare<string, ArtifactRow>(`
    SELECT a.artifact_id, a.task_id, a.type, a.reference, a.metadata, a.created_at
    FROM artifacts a
    INNER JOIN tasks t ON a.task_id = t.task_id
    WHERE t.run_id = ?
    ORDER BY a.created_at ASC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToArtifact(row));
}
