import type Database from 'better-sqlite3';
import type { Organization, Initiative } from '../../domain/organization.js';
import { rowToOrganization, rowToInitiative } from './converters.js';
import type { OrganizationRow, InitiativeRow } from './converters.js';

// ============================================
// Organization operations
// ============================================

export function createOrganization(db: Database.Database, org: Organization): Organization {
  const stmt = db.prepare(`
    INSERT INTO organizations (org_id, name, slug, created_at, updated_at)
    VALUES (@org_id, @name, @slug, @created_at, @updated_at)
  `);
  stmt.run({
    org_id: org.org_id,
    name: org.name,
    slug: org.slug,
    created_at: org.created_at,
    updated_at: org.updated_at,
  });
  return org;
}

export function getOrganization(db: Database.Database, orgId: string): Organization | null {
  const stmt = db.prepare<string, OrganizationRow>(`
    SELECT org_id, name, slug, created_at, updated_at
    FROM organizations
    WHERE org_id = ?
  `);
  const row = stmt.get(orgId);
  if (!row) return null;
  return rowToOrganization(row);
}

export function listOrganizations(db: Database.Database): Organization[] {
  const stmt = db.prepare<[], OrganizationRow>(`
    SELECT org_id, name, slug, created_at, updated_at
    FROM organizations
    ORDER BY name ASC
  `);
  const rows = stmt.all();
  return rows.map((row) => rowToOrganization(row));
}

// ============================================
// Initiative operations
// ============================================

export function createInitiative(db: Database.Database, initiative: Initiative): Initiative {
  const stmt = db.prepare(`
    INSERT INTO initiatives (
      initiative_id, org_id, name, description, status,
      icon, color, display_order, created_at, updated_at
    )
    VALUES (
      @initiative_id, @org_id, @name, @description, @status,
      @icon, @color, @display_order, @created_at, @updated_at
    )
  `);
  stmt.run({
    initiative_id: initiative.initiative_id,
    org_id: initiative.org_id,
    name: initiative.name,
    description: initiative.description ?? null,
    status: initiative.status,
    icon: initiative.icon ?? null,
    color: initiative.color ?? null,
    display_order: initiative.display_order,
    created_at: initiative.created_at,
    updated_at: initiative.updated_at,
  });
  return initiative;
}

export function getInitiative(db: Database.Database, initiativeId: string): Initiative | null {
  const stmt = db.prepare<string, InitiativeRow>(`
    SELECT initiative_id, org_id, name, description, status,
           icon, color, display_order, created_at, updated_at
    FROM initiatives
    WHERE initiative_id = ?
  `);
  const row = stmt.get(initiativeId);
  if (!row) return null;
  return rowToInitiative(row);
}

export function updateInitiative(
  db: Database.Database,
  initiativeId: string,
  updates: Partial<Initiative>
): Initiative | null {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: Record<string, unknown> = { initiative_id: initiativeId, updated_at: now };

  if (updates.name !== undefined) {
    fields.push('name = @name');
    values.name = updates.name;
  }
  if (updates.description !== undefined) {
    fields.push('description = @description');
    values.description = updates.description ?? null;
  }
  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.icon !== undefined) {
    fields.push('icon = @icon');
    values.icon = updates.icon ?? null;
  }
  if (updates.color !== undefined) {
    fields.push('color = @color');
    values.color = updates.color ?? null;
  }
  if (updates.display_order !== undefined) {
    fields.push('display_order = @display_order');
    values.display_order = updates.display_order;
  }

  if (fields.length === 0) {
    return getInitiative(db, initiativeId);
  }

  fields.push('updated_at = @updated_at');

  const stmt = db.prepare(`
    UPDATE initiatives
    SET ${fields.join(', ')}
    WHERE initiative_id = @initiative_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getInitiative(db, initiativeId);
}

export function deleteInitiative(db: Database.Database, initiativeId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM initiatives
    WHERE initiative_id = ?
  `);
  const result = stmt.run(initiativeId);
  return result.changes > 0;
}

export function listInitiatives(db: Database.Database, orgId: string): Initiative[] {
  const stmt = db.prepare<string, InitiativeRow>(`
    SELECT initiative_id, org_id, name, description, status,
           icon, color, display_order, created_at, updated_at
    FROM initiatives
    WHERE org_id = ?
    ORDER BY display_order ASC, name ASC
  `);
  const rows = stmt.all(orgId);
  return rows.map((row) => rowToInitiative(row));
}
