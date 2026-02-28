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

  // 5. Ensure projects table exists (for tend project entity)
  ensureProjectsTable(db);

  // 6. Add source_json column to plans if missing
  migratePlansSource(db);

  // 7. Add understanding_json column to versions if missing
  migrateVersionsUnderstanding(db);

  // 8. Add context_json column to versions if missing
  migrateVersionsContext(db);

  // 9. Add priority and value_score columns to plans if missing
  migratePlansPriorityValueScore(db);

  // 10. Add source_session_id column to plans if missing, backfill from source_json
  migratePlansSourceSessionId(db);
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
 * Ensures the projects table exists.
 * Projects link ideation sessions, plans, and forge runs into a unified entity.
 */
function ensureProjectsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      owner_id TEXT,
      initiative_id TEXT,
      session_id TEXT,
      plan_id TEXT,
      run_id TEXT,
      config TEXT,
      current_focus TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (initiative_id) REFERENCES initiatives(initiative_id) ON DELETE SET NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE SET NULL
    )
  `);
}

/**
 * Adds source_json column to plans table if missing.
 * Tracks plan origin: manual, ideation, or intake.
 */
function migratePlansSource(db: Database.Database): void {
  // Check if source_json column exists
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(plans)`)
    .all();
  const hasSource = columns.some((c) => c.name === 'source_json');

  if (!hasSource) {
    // Add column with default value for existing plans
    db.exec(`ALTER TABLE plans ADD COLUMN source_json TEXT NOT NULL DEFAULT '{"type":"manual"}'`);
  }
}

/**
 * Adds understanding_json column to versions table if missing.
 * Stores freeform specialist observations from ideation.
 */
function migrateVersionsUnderstanding(db: Database.Database): void {
  // Check if understanding_json column exists
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(versions)`)
    .all();
  const hasUnderstanding = columns.some((c) => c.name === 'understanding_json');

  if (!hasUnderstanding) {
    // Add column with default value for existing versions
    db.exec(`ALTER TABLE versions ADD COLUMN understanding_json TEXT NOT NULL DEFAULT '{}'`);
  }
}

/**
 * Adds context_json column to versions table if missing.
 * Stores structured role-keyed decisions (architect, designer, etc.) from planning.
 */
function migrateVersionsContext(db: Database.Database): void {
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(versions)`)
    .all();
  const hasContext = columns.some((c) => c.name === 'context_json');

  if (!hasContext) {
    db.exec(`ALTER TABLE versions ADD COLUMN context_json TEXT NOT NULL DEFAULT '{}'`);
  }
}

/**
 * Adds priority and value_score columns to plans table if missing.
 * Priority: 1-5 scale (how urgent/important), default 3
 * Value Score: 1-10 scale (how valuable), default 5
 */
function migratePlansPriorityValueScore(db: Database.Database): void {
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(plans)`)
    .all();
  const hasPriority = columns.some((c) => c.name === 'priority');
  const hasValueScore = columns.some((c) => c.name === 'value_score');

  if (!hasPriority) {
    db.exec(`ALTER TABLE plans ADD COLUMN priority INTEGER NOT NULL DEFAULT 3`);
  }

  if (!hasValueScore) {
    db.exec(`ALTER TABLE plans ADD COLUMN value_score INTEGER NOT NULL DEFAULT 5`);
  }
}

/**
 * Adds source_session_id column to plans table if missing and backfills from source_json.
 * Enables efficient querying of all plans originating from a given ideation session.
 * This is a soft foreign key — sessions live in ideation.db, so no FK constraint is used.
 */
function migratePlansSourceSessionId(db: Database.Database): void {
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(plans)`)
    .all();
  const hasSourceSessionId = columns.some((c) => c.name === 'source_session_id');

  if (!hasSourceSessionId) {
    db.exec(`ALTER TABLE plans ADD COLUMN source_session_id TEXT`);
  }

  // Backfill from existing source_json for plans that have a session_id in source
  db.exec(`
    UPDATE plans
    SET source_session_id = json_extract(source_json, '$.session_id')
    WHERE source_session_id IS NULL
      AND json_extract(source_json, '$.session_id') IS NOT NULL
  `);
}
