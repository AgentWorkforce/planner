import Database from 'better-sqlite3';
import { createOrganization } from '../domain/organization.js';

/**
 * Database migration system for handling schema changes.
 * All migrations should be idempotent (safe to run multiple times).
 */

/**
 * Runs all pending migrations in order.
 * Called automatically on server start.
 *
 * This migration handles both fresh databases and existing databases
 * that were created before multi-org/initiative support was added.
 */
export function runMigrations(db: Database.Database): void {
  // 1. Ensure organizations table exists (needed before other migrations)
  ensureOrganizationsTable(db);

  // 2. Ensure default org exists
  const defaultOrg = ensureDefaultOrganization(db);

  // 3. Add org_id column to plans if missing
  migrateExistingPlans(db, defaultOrg.org_id);

  // 4. Add metadata_json column to versions if missing
  migrateVersionsMetadata(db);

  // 5. Add understanding_json column to versions if missing
  migrateVersionsUnderstanding(db);

  // 6. Add context_json column to versions if missing
  migrateVersionsContext(db);
}

/**
 * Ensures the organizations table exists.
 * This must run before other migrations that depend on it.
 */
function ensureOrganizationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      org_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

/**
 * Ensures the default organization exists.
 * This org is used for plans created before multi-org support.
 */
function ensureDefaultOrganization(db: Database.Database): { org_id: string } {
  // Check if default org exists
  const existing = db
    .prepare<string, { org_id: string }>(
      `SELECT org_id FROM organizations WHERE slug = ?`
    )
    .get('default');

  if (existing) {
    return existing;
  }

  // Create default org
  const org = createOrganization('Default', 'default');
  db.prepare(
    `INSERT INTO organizations (org_id, name, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(org.org_id, org.name, org.slug, org.created_at, org.updated_at);

  return { org_id: org.org_id };
}

/**
 * Migrates existing plans table to include org_id, initiative_id, and owner_user_id.
 * This migration handles databases created before multi-org/initiative support.
 */
function migrateExistingPlans(db: Database.Database, defaultOrgId: string): void {
  // Check if org_id column exists
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(plans)`)
    .all();
  const hasOrgId = columns.some((c) => c.name === 'org_id');

  if (!hasOrgId) {
    // Add new columns to existing table
    db.exec(`ALTER TABLE plans ADD COLUMN org_id TEXT`);
    db.exec(`ALTER TABLE plans ADD COLUMN initiative_id TEXT`);
    db.exec(`ALTER TABLE plans ADD COLUMN owner_user_id TEXT`);
  }

  // Update plans with null org_id to use default org
  db.prepare(`UPDATE plans SET org_id = ? WHERE org_id IS NULL`).run(
    defaultOrgId
  );
}

/**
 * Adds metadata_json column to versions table if missing.
 * Supports storing arbitrary metadata for version tracking (revision source, etc.)
 */
function migrateVersionsMetadata(db: Database.Database): void {
  // Check if metadata_json column exists
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(versions)`)
    .all();
  const hasMetadata = columns.some((c) => c.name === 'metadata_json');

  if (!hasMetadata) {
    db.exec(`ALTER TABLE versions ADD COLUMN metadata_json TEXT`);
  }
}

/**
 * Adds understanding_json column to versions table if missing.
 * Understanding stores plan-level agent observations keyed by role.
 * Migrates existing records to have empty understanding ({}).
 */
function migrateVersionsUnderstanding(db: Database.Database): void {
  // Check if understanding_json column exists
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(versions)`)
    .all();
  const hasUnderstanding = columns.some((c) => c.name === 'understanding_json');

  if (!hasUnderstanding) {
    db.exec(`ALTER TABLE versions ADD COLUMN understanding_json TEXT`);
  }

  // Migrate existing records with NULL understanding to empty object
  const result = db
    .prepare(`UPDATE versions SET understanding_json = '{}' WHERE understanding_json IS NULL`)
    .run();

  if (result.changes > 0) {
    console.log(`Migrated ${result.changes} existing plan versions with empty understanding`);
  }
}

/**
 * Adds context_json column to versions table if missing.
 * Context stores plan-level formalized decisions keyed by role.
 * Unlike understanding (observations), context captures crystallized decisions.
 */
function migrateVersionsContext(db: Database.Database): void {
  // Check if context_json column exists
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(versions)`)
    .all();
  const hasContext = columns.some((c) => c.name === 'context_json');

  if (!hasContext) {
    db.exec(`ALTER TABLE versions ADD COLUMN context_json TEXT`);
  }

  // Note: Unlike understanding, we don't migrate NULL to empty object.
  // Context starts undefined until a role explicitly adds decisions.
}
