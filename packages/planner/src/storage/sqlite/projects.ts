import type Database from 'better-sqlite3';
import type { Project, ProjectFilter } from '../interface.js';

/**
 * Row type for project database queries
 */
export interface ProjectRow {
  id: string;
  name: string;
  owner_id: string | null;
  initiative_id: string | null;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  config: string | null;
  current_focus: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to Project domain object
 */
function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    owner_id: row.owner_id,
    initiative_id: row.initiative_id,
    session_id: row.session_id,
    plan_id: row.plan_id,
    run_id: row.run_id,
    config: row.config ? JSON.parse(row.config) : null,
    current_focus: row.current_focus ? JSON.parse(row.current_focus) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============================================
// Project operations
// ============================================

export function createProject(db: Database.Database, project: Project): Project {
  const stmt = db.prepare(`
    INSERT INTO projects (
      id, name, owner_id, initiative_id, session_id, plan_id, run_id,
      config, current_focus, created_at, updated_at
    )
    VALUES (
      @id, @name, @owner_id, @initiative_id, @session_id, @plan_id, @run_id,
      @config, @current_focus, @created_at, @updated_at
    )
  `);
  stmt.run({
    id: project.id,
    name: project.name,
    owner_id: project.owner_id,
    initiative_id: project.initiative_id,
    session_id: project.session_id,
    plan_id: project.plan_id,
    run_id: project.run_id,
    config: project.config ? JSON.stringify(project.config) : null,
    current_focus: project.current_focus ? JSON.stringify(project.current_focus) : null,
    created_at: project.created_at,
    updated_at: project.updated_at,
  });
  return project;
}

export function getProject(db: Database.Database, id: string): Project | null {
  const stmt = db.prepare<string, ProjectRow>(`
    SELECT id, name, owner_id, initiative_id, session_id, plan_id, run_id,
           config, current_focus, created_at, updated_at
    FROM projects
    WHERE id = ?
  `);
  const row = stmt.get(id);
  if (!row) return null;
  return rowToProject(row);
}

export function updateProject(
  db: Database.Database,
  id: string,
  updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>
): Project | null {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: Record<string, unknown> = { id, updated_at: now };

  if (updates.name !== undefined) {
    fields.push('name = @name');
    values.name = updates.name;
  }
  if (updates.owner_id !== undefined) {
    fields.push('owner_id = @owner_id');
    values.owner_id = updates.owner_id;
  }
  if (updates.initiative_id !== undefined) {
    fields.push('initiative_id = @initiative_id');
    values.initiative_id = updates.initiative_id;
  }
  if (updates.session_id !== undefined) {
    fields.push('session_id = @session_id');
    values.session_id = updates.session_id;
  }
  if (updates.plan_id !== undefined) {
    fields.push('plan_id = @plan_id');
    values.plan_id = updates.plan_id;
  }
  if (updates.run_id !== undefined) {
    fields.push('run_id = @run_id');
    values.run_id = updates.run_id;
  }
  if (updates.config !== undefined) {
    fields.push('config = @config');
    values.config = updates.config ? JSON.stringify(updates.config) : null;
  }
  if (updates.current_focus !== undefined) {
    fields.push('current_focus = @current_focus');
    values.current_focus = updates.current_focus ? JSON.stringify(updates.current_focus) : null;
  }

  if (fields.length === 0) {
    return getProject(db, id);
  }

  fields.push('updated_at = @updated_at');

  const stmt = db.prepare(`
    UPDATE projects
    SET ${fields.join(', ')}
    WHERE id = @id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getProject(db, id);
}

export function updateProjectFocus(
  db: Database.Database,
  id: string,
  focus: Record<string, unknown>
): Project | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE projects
    SET current_focus = @current_focus, updated_at = @updated_at
    WHERE id = @id
  `);
  const result = stmt.run({
    id,
    current_focus: JSON.stringify(focus),
    updated_at: now,
  });
  if (result.changes === 0) return null;
  return getProject(db, id);
}

export function listProjects(db: Database.Database, filter?: ProjectFilter): Project[] {
  const whereClauses: string[] = [];
  const values: Record<string, unknown> = {};

  if (filter?.owner_id) {
    whereClauses.push('owner_id = @owner_id');
    values.owner_id = filter.owner_id;
  }
  if (filter?.initiative_id) {
    whereClauses.push('initiative_id = @initiative_id');
    values.initiative_id = filter.initiative_id;
  }
  if (filter?.session_id) {
    whereClauses.push('session_id = @session_id');
    values.session_id = filter.session_id;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  if (whereClauses.length > 0) {
    const stmt = db.prepare<Record<string, unknown>, ProjectRow>(`
      SELECT id, name, owner_id, initiative_id, session_id, plan_id, run_id,
             config, current_focus, created_at, updated_at
      FROM projects
      ${whereClause}
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(values);
    return rows.map((row) => rowToProject(row));
  } else {
    const stmt = db.prepare<[], ProjectRow>(`
      SELECT id, name, owner_id, initiative_id, session_id, plan_id, run_id,
             config, current_focus, created_at, updated_at
      FROM projects
      ORDER BY created_at DESC
    `);
    const rows = stmt.all();
    return rows.map((row) => rowToProject(row));
  }
}

export function deleteProject(db: Database.Database, id: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM projects
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}
