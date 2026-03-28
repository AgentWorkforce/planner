/**
 * Cultivate storage layer
 * Stub implementation for startup sequence
 */

import { BaseSqliteStorage } from '@plannr/storage-base';

export interface Greenhouse {
  id: string;
  name: string;
  description?: string;
  mode: 'discovery' | 'refinement' | 'focused';
  keyword_require: string[];
  keyword_exclude: string[];
  source_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateGreenhouseInput {
  name: string;
  description?: string;
  mode: 'discovery' | 'refinement' | 'focused';
  keyword_require: string[];
  keyword_exclude: string[];
  source_ids: string[];
}

/**
 * Cultivate storage extending BaseSqliteStorage
 */
export class CultivateStorage extends BaseSqliteStorage {
  constructor(dbPath: string) {
    super(dbPath);
  }

  /**
   * Initialize schema with migrations
   */
  protected initializeSchema(): void {
    // Create greenhouses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS greenhouses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        mode TEXT NOT NULL CHECK(mode IN ('discovery', 'refinement', 'focused')),
        keyword_require TEXT NOT NULL, -- JSON array
        keyword_exclude TEXT NOT NULL, -- JSON array
        source_ids TEXT NOT NULL, -- JSON array
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create signals table (stub for now)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT NOT NULL,
        author_type TEXT NOT NULL,
        url TEXT,
        score REAL NOT NULL,
        scoring_factors TEXT NOT NULL, -- JSON
        cluster_id TEXT,
        status TEXT NOT NULL,
        provenance TEXT NOT NULL, -- JSON array
        tags TEXT NOT NULL, -- JSON array
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        linked_plan_id TEXT,
        FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id),
        UNIQUE(source_type, external_id, greenhouse_id)
      );
    `);

    // Create clusters table (stub for now)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        label TEXT NOT NULL,
        summary TEXT NOT NULL,
        signal_count INTEGER NOT NULL DEFAULT 0,
        trend TEXT NOT NULL CHECK(trend IN ('rising', 'stable', 'declining')),
        velocity_weekly REAL NOT NULL DEFAULT 0,
        velocity_monthly REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id)
      );
    `);

    // Create sources table (stub for now)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        preset TEXT,
        endpoint_template TEXT,
        auth TEXT, -- JSON, encrypted
        poll_interval_ms INTEGER NOT NULL,
        greenhouse_ids TEXT NOT NULL, -- JSON array
        health TEXT NOT NULL CHECK(health IN ('healthy', 'warning', 'unhealthy', 'disabled')),
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);
  }

  /**
   * List all greenhouses
   */
  async listGreenhouses(): Promise<Greenhouse[]> {
    const rows = this.db
      .prepare('SELECT * FROM greenhouses ORDER BY created_at DESC')
      .all() as any[];

    return rows.map((row) => ({
      ...row,
      keyword_require: JSON.parse(row.keyword_require),
      keyword_exclude: JSON.parse(row.keyword_exclude),
      source_ids: JSON.parse(row.source_ids),
    }));
  }

  /**
   * Create a new greenhouse
   */
  async createGreenhouse(input: CreateGreenhouseInput): Promise<Greenhouse> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO greenhouses (
        id, name, description, mode, keyword_require, keyword_exclude, source_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.description ?? null,
      input.mode,
      JSON.stringify(input.keyword_require),
      JSON.stringify(input.keyword_exclude),
      JSON.stringify(input.source_ids),
      now,
      now
    );

    const greenhouse: Greenhouse = {
      id,
      name: input.name,
      description: input.description,
      mode: input.mode,
      keyword_require: input.keyword_require,
      keyword_exclude: input.keyword_exclude,
      source_ids: input.source_ids,
      created_at: now,
      updated_at: now,
    };

    return greenhouse;
  }
}
