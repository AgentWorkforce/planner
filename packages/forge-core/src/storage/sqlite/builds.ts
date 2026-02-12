import type Database from 'better-sqlite3';
import type { Build, BuildStatus, BuildRun, BuildRunStatus } from '../../domain/build-types.js';
import { type BuildRow, type BuildRunRow, rowToBuild, rowToBuildRun } from './converters.js';

/**
 * Create a new Build in the database.
 * @param db - Database instance
 * @param build - Build object to create
 * @returns The created Build
 */
export function createBuild(db: Database.Database, build: Build): Build {
  const stmt = db.prepare(`
    INSERT INTO builds (
      build_id, status, tiers_json, concurrency_limit, skip_completed,
      mode, workspace_path, error,
      created_at, started_at, completed_at, updated_at
    )
    VALUES (
      @build_id, @status, @tiers_json, @concurrency_limit, @skip_completed,
      @mode, @workspace_path, @error,
      @created_at, @started_at, @completed_at, @updated_at
    )
  `);
  stmt.run({
    build_id: build.build_id,
    status: build.status,
    tiers_json: JSON.stringify(build.tiers),
    concurrency_limit: build.concurrency_limit,
    skip_completed: build.skip_completed ? 1 : 0,
    mode: build.mode,
    workspace_path: build.workspace_path ?? null,
    error: build.error ?? null,
    created_at: build.created_at,
    started_at: build.started_at ?? null,
    completed_at: build.completed_at ?? null,
    updated_at: build.updated_at,
  });
  return build;
}

/**
 * Get a Build by ID.
 * @param db - Database instance
 * @param buildId - Build ID
 * @returns The Build or null if not found
 */
export function getBuild(db: Database.Database, buildId: string): Build | null {
  const stmt = db.prepare<string, BuildRow>(`
    SELECT build_id, status, tiers_json, concurrency_limit, skip_completed,
           mode, workspace_path, error,
           created_at, started_at, completed_at, updated_at
    FROM builds
    WHERE build_id = ?
  `);
  const row = stmt.get(buildId);
  if (!row) return null;
  return rowToBuild(row);
}

/**
 * Update a Build with partial updates.
 * @param db - Database instance
 * @param buildId - Build ID
 * @param updates - Partial Build object with fields to update
 * @returns The updated Build or null if not found
 */
export function updateBuild(db: Database.Database, buildId: string, updates: Partial<Build>): Build | null {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = @updated_at'];
  const values: Record<string, unknown> = { build_id: buildId, updated_at: now };

  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.tiers !== undefined) {
    fields.push('tiers_json = @tiers_json');
    values.tiers_json = JSON.stringify(updates.tiers);
  }
  if (updates.concurrency_limit !== undefined) {
    fields.push('concurrency_limit = @concurrency_limit');
    values.concurrency_limit = updates.concurrency_limit;
  }
  if (updates.skip_completed !== undefined) {
    fields.push('skip_completed = @skip_completed');
    values.skip_completed = updates.skip_completed ? 1 : 0;
  }
  if (updates.mode !== undefined) {
    fields.push('mode = @mode');
    values.mode = updates.mode;
  }
  if (updates.workspace_path !== undefined) {
    fields.push('workspace_path = @workspace_path');
    values.workspace_path = updates.workspace_path ?? null;
  }
  if (updates.error !== undefined) {
    fields.push('error = @error');
    values.error = updates.error ?? null;
  }
  if (updates.started_at !== undefined) {
    fields.push('started_at = @started_at');
    values.started_at = updates.started_at ?? null;
  }
  if (updates.completed_at !== undefined) {
    fields.push('completed_at = @completed_at');
    values.completed_at = updates.completed_at ?? null;
  }

  const stmt = db.prepare(`
    UPDATE builds
    SET ${fields.join(', ')}
    WHERE build_id = @build_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getBuild(db, buildId);
}

/**
 * Update a Build's status.
 * @param db - Database instance
 * @param buildId - Build ID
 * @param status - New BuildStatus
 * @returns The updated Build or null if not found
 */
export function updateBuildStatus(db: Database.Database, buildId: string, status: BuildStatus): Build | null {
  return updateBuild(db, buildId, { status });
}

/**
 * List all Builds, optionally filtered by status.
 * @param db - Database instance
 * @param status - Optional status filter
 * @returns Array of Builds ordered by created_at DESC
 */
export function listBuilds(db: Database.Database, status?: BuildStatus): Build[] {
  let sql = `
    SELECT build_id, status, tiers_json, concurrency_limit, skip_completed,
           mode, workspace_path, error,
           created_at, started_at, completed_at, updated_at
    FROM builds
  `;
  const params: unknown[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare<unknown[], BuildRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToBuild(row));
}

/**
 * Get all active Builds (pending or running).
 * @param db - Database instance
 * @returns Array of active Builds ordered by created_at ASC
 */
export function getActiveBuilds(db: Database.Database): Build[] {
  const stmt = db.prepare<[], BuildRow>(`
    SELECT build_id, status, tiers_json, concurrency_limit, skip_completed,
           mode, workspace_path, error,
           created_at, started_at, completed_at, updated_at
    FROM builds
    WHERE status IN ('pending', 'running')
    ORDER BY created_at ASC
  `);
  const rows = stmt.all();
  return rows.map((row) => rowToBuild(row));
}

/**
 * Create a new BuildRun in the database.
 * @param db - Database instance
 * @param buildRun - BuildRun object to create
 * @returns The created BuildRun
 */
export function createBuildRun(db: Database.Database, buildRun: BuildRun): BuildRun {
  const stmt = db.prepare(`
    INSERT INTO build_runs (
      build_id, run_id, plan_id, plan_version, tier, status,
      created_at, updated_at
    )
    VALUES (
      @build_id, @run_id, @plan_id, @plan_version, @tier, @status,
      @created_at, @updated_at
    )
  `);
  stmt.run({
    build_id: buildRun.build_id,
    run_id: buildRun.run_id,
    plan_id: buildRun.plan_id,
    plan_version: buildRun.plan_version ?? null,
    tier: buildRun.tier,
    status: buildRun.status,
    created_at: buildRun.created_at,
    updated_at: buildRun.updated_at,
  });
  return buildRun;
}

/**
 * Get a BuildRun by composite key (build_id, run_id).
 * @param db - Database instance
 * @param buildId - Build ID
 * @param runId - Run ID
 * @returns The BuildRun or null if not found
 */
export function getBuildRun(db: Database.Database, buildId: string, runId: string): BuildRun | null {
  const stmt = db.prepare<[string, string], BuildRunRow>(`
    SELECT build_id, run_id, plan_id, plan_version, tier, status,
           created_at, updated_at
    FROM build_runs
    WHERE build_id = ? AND run_id = ?
  `);
  const row = stmt.get(buildId, runId);
  if (!row) return null;
  return rowToBuildRun(row);
}

/**
 * Update a BuildRun's status.
 * @param db - Database instance
 * @param buildId - Build ID
 * @param runId - Run ID
 * @param status - New BuildRunStatus
 * @returns The updated BuildRun or null if not found
 */
export function updateBuildRunStatus(
  db: Database.Database,
  buildId: string,
  runId: string,
  status: BuildRunStatus
): BuildRun | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE build_runs
    SET status = @status, updated_at = @updated_at
    WHERE build_id = @build_id AND run_id = @run_id
  `);
  const result = stmt.run({
    build_id: buildId,
    run_id: runId,
    status,
    updated_at: now,
  });
  if (result.changes === 0) return null;
  return getBuildRun(db, buildId, runId);
}

/**
 * List all BuildRuns for a Build.
 * @param db - Database instance
 * @param buildId - Build ID
 * @returns Array of BuildRuns ordered by tier ASC, created_at ASC
 */
export function listBuildRunsByBuild(db: Database.Database, buildId: string): BuildRun[] {
  const stmt = db.prepare<string, BuildRunRow>(`
    SELECT build_id, run_id, plan_id, plan_version, tier, status,
           created_at, updated_at
    FROM build_runs
    WHERE build_id = ?
    ORDER BY tier ASC, created_at ASC
  `);
  const rows = stmt.all(buildId);
  return rows.map((row) => rowToBuildRun(row));
}

/**
 * List all BuildRuns for a Build at a specific tier.
 * @param db - Database instance
 * @param buildId - Build ID
 * @param tier - Tier number
 * @returns Array of BuildRuns ordered by created_at ASC
 */
export function listBuildRunsByTier(db: Database.Database, buildId: string, tier: number): BuildRun[] {
  const stmt = db.prepare<[string, number], BuildRunRow>(`
    SELECT build_id, run_id, plan_id, plan_version, tier, status,
           created_at, updated_at
    FROM build_runs
    WHERE build_id = ? AND tier = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(buildId, tier);
  return rows.map((row) => rowToBuildRun(row));
}
