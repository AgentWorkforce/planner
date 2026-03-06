/**
 * SQLite implementation of CultivateStorage
 */

import { randomUUID } from 'node:crypto';
import { BaseSqliteStorage } from '@plannr/storage-base';
import type {
  Signal,
  SignalStatus,
  Greenhouse,
  Cluster,
  SourceConfig,
  FilterRule,
  IngestionJob,
  CultivateConfig,
  AdapterType,
  ScoringFactors,
  StepProvenance,
  ExtractionResult,
} from '../domain/types';
import type { Profile, IcpSegment } from '../domain/profile-types';
import type {
  CultivateStorage,
  SignalQueryFilters,
  CreateSignalInput,
  UpdateSignalInput,
  CreateGreenhouseInput,
  UpdateGreenhouseInput,
  CreateClusterInput,
  UpdateClusterInput,
  CreateSourceConfigInput,
  UpdateSourceConfigInput,
  UpdateSourceHealthInput,
  CreateFilterRuleInput,
  UpdateFilterRuleInput,
  UpdateFilterEffectivenessInput,
  CreateIngestionJobInput,
  UpdateIngestionJobInput,
  UpsertProfileInput,
  ProfileQueryFilters,
  CreateSegmentInput,
} from './interface';

/**
 * SQLite storage implementation for Cultivate domain
 */
export class SqliteCultivateStorage extends BaseSqliteStorage implements CultivateStorage {
  /**
   * Initialize database schema with all tables and indexes
   */
  protected initializeSchema(): void {
    // Signals table
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
        score REAL DEFAULT 0,
        scoring_factors TEXT NOT NULL,
        cluster_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        provenance TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        linked_plan_id TEXT,
        UNIQUE(source_type, external_id)
      )
    `);

    // Extractions table - stores AI-extracted insights per signal
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS extractions (
        id TEXT PRIMARY KEY,
        signal_id TEXT NOT NULL UNIQUE,
        keywords TEXT NOT NULL,
        summary TEXT NOT NULL,
        entities TEXT NOT NULL,
        aspects TEXT NOT NULL,
        quotes TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        specificity REAL NOT NULL,
        emotional_intensity REAL NOT NULL,
        actionability REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE CASCADE
      )
    `);

    // Greenhouses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS greenhouses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        mode TEXT NOT NULL,
        keyword_require TEXT NOT NULL,
        keyword_exclude TEXT NOT NULL,
        source_ids TEXT NOT NULL,
        weight_overrides TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Clusters table
    // Per-Greenhouse isolation enforced at schema level:
    // - greenhouse_id NOT NULL ensures every cluster belongs to a greenhouse
    // - FOREIGN KEY ensures greenhouse must exist
    // - (greenhouse_id, label) UNIQUE prevents duplicate labels within a greenhouse
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        label TEXT NOT NULL,
        summary TEXT NOT NULL,
        signal_count INTEGER NOT NULL DEFAULT 0,
        trend TEXT NOT NULL,
        velocity_weekly REAL NOT NULL DEFAULT 0,
        velocity_monthly REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id) ON DELETE CASCADE,
        UNIQUE(greenhouse_id, label)
      )
    `);

    // Source configs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        preset TEXT,
        endpoint_template TEXT,
        auth TEXT,
        poll_interval_ms INTEGER NOT NULL,
        greenhouse_ids TEXT NOT NULL,
        health TEXT NOT NULL,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);

    // Filter rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS filter_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        condition TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        effectiveness TEXT NOT NULL
      )
    `);

    // Ingestion jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingestion_jobs (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        status TEXT NOT NULL,
        total_chunks INTEGER NOT NULL,
        processed_chunks INTEGER NOT NULL DEFAULT 0,
        greenhouse_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Cultivate config table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cultivate_config (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        weights TEXT NOT NULL,
        filter_rules TEXT NOT NULL,
        tier1_strictness REAL NOT NULL,
        tier2_threshold REAL NOT NULL,
        extract_model TEXT,
        cluster_model TEXT
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_source_external_id ON signals(source_type, external_id);
      CREATE INDEX IF NOT EXISTS idx_signals_greenhouse_id ON signals(greenhouse_id);
      CREATE INDEX IF NOT EXISTS idx_signals_cluster_id ON signals(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
      CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
      CREATE INDEX IF NOT EXISTS idx_clusters_greenhouse_id ON clusters(greenhouse_id);
      CREATE INDEX IF NOT EXISTS idx_clusters_trend ON clusters(trend);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_extractions_signal_id ON extractions(signal_id);
    `);

    // Migration: add intent column to signals table
    try {
      this.db.exec(`ALTER TABLE signals ADD COLUMN intent TEXT`);
    } catch (_) {
      // Column already exists - safe to ignore
    }
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_signals_intent ON signals(intent)`);

    // Profiles table - aggregates per-author statistics from signals
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        author TEXT NOT NULL,
        author_type TEXT NOT NULL,
        signal_count INTEGER NOT NULL DEFAULT 0,
        top_intents TEXT NOT NULL DEFAULT '[]',
        top_clusters TEXT NOT NULL DEFAULT '[]',
        source_distribution TEXT NOT NULL DEFAULT '{}',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        segment TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(greenhouse_id, author)
      )
    `);

    // ICP segments table - customer segmentation definitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS icp_segments (
        id TEXT PRIMARY KEY,
        greenhouse_id TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        criteria TEXT NOT NULL DEFAULT '{}',
        profile_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(greenhouse_id, label)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_profiles_greenhouse_id ON profiles(greenhouse_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_segment ON profiles(segment);
    `);

    // Ensure default greenhouse exists
    this.ensureDefaultGreenhouse();
  }

  /**
   * Ensure a default greenhouse exists (only on first initialization when table is empty)
   */
  private ensureDefaultGreenhouse(): void {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM greenhouses').get() as any;

    if (result.count === 0) {
      const id = randomUUID();
      const now = new Date().toISOString();

      this.db
        .prepare(
          `INSERT INTO greenhouses (
            id, name, description, mode, keyword_require, keyword_exclude, source_ids, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          'Default',
          null,
          'refinement',
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([]),
          now,
          now
        );
    }
  }

  // ========== Signal Operations ==========

  async createSignal(input: CreateSignalInput): Promise<Signal> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const signal: Signal = {
      id,
      greenhouse_id: input.greenhouse_id,
      source_type: input.source_type,
      external_id: input.external_id,
      title: input.title,
      body: input.body,
      author: input.author,
      author_type: input.author_type,
      url: input.url,
      score: input.score,
      scoring_factors: input.scoring_factors as ScoringFactors,
      cluster_id: undefined,
      status: input.status,
      provenance: [],
      tags: input.tags || [],
      created_at: now,
      updated_at: now,
      linked_plan_id: undefined,
      intent: input.intent as Signal['intent'],
    };

    this.db
      .prepare(
        `INSERT INTO signals (
          id, greenhouse_id, source_type, external_id, title, body, author, author_type,
          url, score, scoring_factors, cluster_id, status, provenance, tags,
          created_at, updated_at, linked_plan_id, intent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        signal.id,
        signal.greenhouse_id,
        signal.source_type,
        signal.external_id,
        signal.title,
        signal.body,
        signal.author,
        signal.author_type,
        signal.url || null,
        signal.score,
        JSON.stringify(signal.scoring_factors),
        signal.cluster_id || null,
        signal.status,
        JSON.stringify(signal.provenance),
        JSON.stringify(signal.tags),
        signal.created_at,
        signal.updated_at,
        signal.linked_plan_id || null,
        signal.intent || null
      );

    return signal;
  }

  async getSignalById(id: string): Promise<Signal | null> {
    const row = this.db.prepare('SELECT * FROM signals WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToSignal(row);
  }

  async getSignalByExternalId(source_type: AdapterType, external_id: string): Promise<Signal | null> {
    const row = this.db
      .prepare('SELECT * FROM signals WHERE source_type = ? AND external_id = ?')
      .get(source_type, external_id) as any;
    if (!row) return null;
    return this.mapRowToSignal(row);
  }

  /**
   * Check for an exact duplicate signal by source_type and external_id
   * Used to reject already-processed signals before the pipeline
   * @param source_type - The source adapter type
   * @param external_id - The external identifier from the source
   * @returns The existing signal ID if duplicate found, null otherwise
   */
  async checkExactDuplicate(source_type: AdapterType, external_id: string): Promise<string | null> {
    const row = this.db
      .prepare('SELECT id FROM signals WHERE source_type = ? AND external_id = ?')
      .get(source_type, external_id) as any;
    return row ? row.id : null;
  }

  async updateSignal(id: string, input: UpdateSignalInput): Promise<Signal> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.score !== undefined) {
      updates.push('score = ?');
      values.push(input.score);
    }
    if (input.scoring_factors !== undefined) {
      updates.push('scoring_factors = ?');
      values.push(JSON.stringify(input.scoring_factors));
    }
    if (input.cluster_id !== undefined) {
      updates.push('cluster_id = ?');
      values.push(input.cluster_id);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }
    if (input.linked_plan_id !== undefined) {
      updates.push('linked_plan_id = ?');
      values.push(input.linked_plan_id);
    }
    if (input.intent !== undefined) {
      updates.push('intent = ?');
      values.push(input.intent);
    }
    if (input.provenance !== undefined) {
      updates.push('provenance = ?');
      values.push(JSON.stringify(input.provenance));
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    this.db.prepare(`UPDATE signals SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getSignalById(id);
    if (!updated) throw new Error(`Signal ${id} not found after update`);
    return updated;
  }

  async listSignals(filters: SignalQueryFilters): Promise<Signal[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.greenhouse_id) {
      conditions.push('greenhouse_id = ?');
      values.push(filters.greenhouse_id);
    }
    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }
    if (filters.cluster_id) {
      conditions.push('cluster_id = ?');
      values.push(filters.cluster_id);
    }
    if (filters.intent) {
      conditions.push('intent = ?');
      values.push(filters.intent);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(filters.limit, filters.offset);

    const rows = this.db
      .prepare(`SELECT * FROM signals ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...values) as any[];

    return rows.map((row) => this.mapRowToSignal(row));
  }

  async countSignalsByStatus(status: SignalStatus): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM signals WHERE status = ?').get(status) as any;
    return row.count;
  }

  // ========== Greenhouse Operations ==========

  async createGreenhouse(input: CreateGreenhouseInput): Promise<Greenhouse> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const greenhouse: Greenhouse = {
      id,
      name: input.name,
      description: input.description,
      mode: input.mode,
      keyword_require: input.keyword_require,
      keyword_exclude: input.keyword_exclude,
      source_ids: input.source_ids,
      weight_overrides: input.weight_overrides,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO greenhouses (
          id, name, description, mode, keyword_require, keyword_exclude, source_ids, weight_overrides, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        greenhouse.id,
        greenhouse.name,
        greenhouse.description || null,
        greenhouse.mode,
        JSON.stringify(greenhouse.keyword_require),
        JSON.stringify(greenhouse.keyword_exclude),
        JSON.stringify(greenhouse.source_ids),
        input.weight_overrides ? JSON.stringify(input.weight_overrides) : null,
        greenhouse.created_at,
        greenhouse.updated_at
      );

    return greenhouse;
  }

  async getGreenhouseById(id: string): Promise<Greenhouse | null> {
    const row = this.db.prepare('SELECT * FROM greenhouses WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToGreenhouse(row);
  }

  async updateGreenhouse(id: string, input: UpdateGreenhouseInput): Promise<Greenhouse> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.mode !== undefined) {
      updates.push('mode = ?');
      values.push(input.mode);
    }
    if (input.keyword_require !== undefined) {
      updates.push('keyword_require = ?');
      values.push(JSON.stringify(input.keyword_require));
    }
    if (input.keyword_exclude !== undefined) {
      updates.push('keyword_exclude = ?');
      values.push(JSON.stringify(input.keyword_exclude));
    }
    if (input.source_ids !== undefined) {
      updates.push('source_ids = ?');
      values.push(JSON.stringify(input.source_ids));
    }
    if (input.weight_overrides !== undefined) {
      updates.push('weight_overrides = ?');
      values.push(JSON.stringify(input.weight_overrides));
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    this.db.prepare(`UPDATE greenhouses SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getGreenhouseById(id);
    if (!updated) throw new Error(`Greenhouse ${id} not found after update`);
    return updated;
  }

  async deleteGreenhouse(id: string): Promise<void> {
    this.db.prepare('DELETE FROM greenhouses WHERE id = ?').run(id);
  }

  async listGreenhouses(): Promise<Greenhouse[]> {
    const rows = this.db.prepare('SELECT * FROM greenhouses ORDER BY created_at DESC').all() as any[];
    return rows.map((row) => this.mapRowToGreenhouse(row));
  }

  // ========== Cluster Operations ==========

  async createCluster(input: CreateClusterInput): Promise<Cluster> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const cluster: Cluster = {
      id,
      greenhouse_id: input.greenhouse_id,
      label: input.label,
      summary: input.summary,
      signal_count: input.signal_count || 0,
      trend: input.trend || 'stable',
      velocity_weekly: input.velocity_weekly || 0,
      velocity_monthly: input.velocity_monthly || 0,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO clusters (
          id, greenhouse_id, label, summary, signal_count, trend, velocity_weekly, velocity_monthly, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cluster.id,
        cluster.greenhouse_id,
        cluster.label,
        cluster.summary,
        cluster.signal_count,
        cluster.trend,
        cluster.velocity_weekly,
        cluster.velocity_monthly,
        cluster.created_at,
        cluster.updated_at
      );

    return cluster;
  }

  async getClusterById(id: string): Promise<Cluster | null> {
    const row = this.db.prepare('SELECT * FROM clusters WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToCluster(row);
  }

  async getClusterByIdAndGreenhouse(id: string, greenhouse_id: string): Promise<Cluster | null> {
    const row = this.db
      .prepare('SELECT * FROM clusters WHERE id = ? AND greenhouse_id = ?')
      .get(id, greenhouse_id) as any;
    if (!row) return null;
    return this.mapRowToCluster(row);
  }

  async getClusterByLabel(greenhouse_id: string, label: string): Promise<Cluster | null> {
    const row = this.db
      .prepare('SELECT * FROM clusters WHERE greenhouse_id = ? AND label = ?')
      .get(greenhouse_id, label) as any;
    if (!row) return null;
    return this.mapRowToCluster(row);
  }

  async updateCluster(id: string, input: UpdateClusterInput): Promise<Cluster> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.label !== undefined) {
      updates.push('label = ?');
      values.push(input.label);
    }
    if (input.summary !== undefined) {
      updates.push('summary = ?');
      values.push(input.summary);
    }
    if (input.signal_count !== undefined) {
      updates.push('signal_count = ?');
      values.push(input.signal_count);
    }
    if (input.trend !== undefined) {
      updates.push('trend = ?');
      values.push(input.trend);
    }
    if (input.velocity_weekly !== undefined) {
      updates.push('velocity_weekly = ?');
      values.push(input.velocity_weekly);
    }
    if (input.velocity_monthly !== undefined) {
      updates.push('velocity_monthly = ?');
      values.push(input.velocity_monthly);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    this.db.prepare(`UPDATE clusters SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getClusterById(id);
    if (!updated) throw new Error(`Cluster ${id} not found after update`);
    return updated;
  }

  async deleteCluster(id: string): Promise<void> {
    this.db.prepare('DELETE FROM clusters WHERE id = ?').run(id);
  }

  async listClustersByGreenhouse(greenhouse_id: string): Promise<Cluster[]> {
    const rows = this.db
      .prepare('SELECT * FROM clusters WHERE greenhouse_id = ? ORDER BY signal_count DESC')
      .all(greenhouse_id) as any[];
    return rows.map((row) => this.mapRowToCluster(row));
  }

  // ========== Source Config Operations ==========

  async createSourceConfig(input: CreateSourceConfigInput): Promise<SourceConfig> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const sourceConfig: SourceConfig = {
      id,
      name: input.name,
      adapter_type: input.adapter_type,
      preset: input.preset,
      endpoint_template: input.endpoint_template,
      auth: input.auth,
      poll_interval_ms: input.poll_interval_ms,
      greenhouse_ids: input.greenhouse_ids,
      health: 'healthy',
      consecutive_failures: 0,
      last_error: undefined,
      enabled: input.enabled !== undefined ? input.enabled : true,
      created_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO source_configs (
          id, name, adapter_type, preset, endpoint_template, auth, poll_interval_ms,
          greenhouse_ids, health, consecutive_failures, last_error, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sourceConfig.id,
        sourceConfig.name,
        sourceConfig.adapter_type,
        sourceConfig.preset || null,
        sourceConfig.endpoint_template || null,
        sourceConfig.auth ? JSON.stringify(sourceConfig.auth) : null,
        sourceConfig.poll_interval_ms,
        JSON.stringify(sourceConfig.greenhouse_ids),
        sourceConfig.health,
        sourceConfig.consecutive_failures,
        sourceConfig.last_error || null,
        sourceConfig.enabled ? 1 : 0,
        sourceConfig.created_at
      );

    return sourceConfig;
  }

  async getSourceConfigById(id: string): Promise<SourceConfig | null> {
    const row = this.db.prepare('SELECT * FROM source_configs WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToSourceConfig(row);
  }

  async updateSourceConfig(id: string, input: UpdateSourceConfigInput): Promise<SourceConfig> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.adapter_type !== undefined) {
      updates.push('adapter_type = ?');
      values.push(input.adapter_type);
    }
    if (input.preset !== undefined) {
      updates.push('preset = ?');
      values.push(input.preset);
    }
    if (input.endpoint_template !== undefined) {
      updates.push('endpoint_template = ?');
      values.push(input.endpoint_template);
    }
    if (input.auth !== undefined) {
      updates.push('auth = ?');
      values.push(JSON.stringify(input.auth));
    }
    if (input.poll_interval_ms !== undefined) {
      updates.push('poll_interval_ms = ?');
      values.push(input.poll_interval_ms);
    }
    if (input.greenhouse_ids !== undefined) {
      updates.push('greenhouse_ids = ?');
      values.push(JSON.stringify(input.greenhouse_ids));
    }
    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(input.enabled ? 1 : 0);
    }

    values.push(id);

    this.db.prepare(`UPDATE source_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getSourceConfigById(id);
    if (!updated) throw new Error(`SourceConfig ${id} not found after update`);
    return updated;
  }

  async updateSourceHealth(id: string, input: UpdateSourceHealthInput): Promise<SourceConfig> {
    const updates: string[] = ['health = ?'];
    const values: any[] = [input.health];

    if (input.consecutive_failures !== undefined) {
      updates.push('consecutive_failures = ?');
      values.push(input.consecutive_failures);
    }
    if (input.last_error !== undefined) {
      updates.push('last_error = ?');
      values.push(input.last_error);
    }

    values.push(id);

    this.db.prepare(`UPDATE source_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getSourceConfigById(id);
    if (!updated) throw new Error(`SourceConfig ${id} not found after update`);
    return updated;
  }

  async deleteSourceConfig(id: string): Promise<void> {
    this.db.prepare('DELETE FROM source_configs WHERE id = ?').run(id);
  }

  async listSourceConfigs(enabled?: boolean): Promise<SourceConfig[]> {
    let query = 'SELECT * FROM source_configs';
    const values: any[] = [];

    if (enabled !== undefined) {
      query += ' WHERE enabled = ?';
      values.push(enabled ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...values) as any[];
    return rows.map((row) => this.mapRowToSourceConfig(row));
  }

  // ========== Filter Rule Operations ==========

  async createFilterRule(input: CreateFilterRuleInput): Promise<FilterRule> {
    const id = randomUUID();

    const filterRule: FilterRule = {
      id,
      name: input.name,
      description: input.description,
      type: input.type,
      condition: input.condition,
      enabled: input.enabled !== undefined ? input.enabled : true,
      effectiveness: {
        signals_matched: 0,
        false_positive_rate: 0,
      },
    };

    this.db
      .prepare(
        `INSERT INTO filter_rules (
          id, name, description, type, condition, enabled, effectiveness
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        filterRule.id,
        filterRule.name,
        filterRule.description,
        filterRule.type,
        filterRule.condition,
        filterRule.enabled ? 1 : 0,
        JSON.stringify(filterRule.effectiveness)
      );

    return filterRule;
  }

  async getFilterRuleById(id: string): Promise<FilterRule | null> {
    const row = this.db.prepare('SELECT * FROM filter_rules WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToFilterRule(row);
  }

  async updateFilterRule(id: string, input: UpdateFilterRuleInput): Promise<FilterRule> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }
    if (input.condition !== undefined) {
      updates.push('condition = ?');
      values.push(input.condition);
    }
    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(input.enabled ? 1 : 0);
    }

    values.push(id);

    this.db.prepare(`UPDATE filter_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getFilterRuleById(id);
    if (!updated) throw new Error(`FilterRule ${id} not found after update`);
    return updated;
  }

  async updateFilterEffectiveness(id: string, input: UpdateFilterEffectivenessInput): Promise<FilterRule> {
    const effectiveness = {
      signals_matched: input.signals_matched,
      false_positive_rate: input.false_positive_rate,
    };

    this.db.prepare('UPDATE filter_rules SET effectiveness = ? WHERE id = ?').run(JSON.stringify(effectiveness), id);

    const updated = await this.getFilterRuleById(id);
    if (!updated) throw new Error(`FilterRule ${id} not found after update`);
    return updated;
  }

  async deleteFilterRule(id: string): Promise<void> {
    this.db.prepare('DELETE FROM filter_rules WHERE id = ?').run(id);
  }

  async listFilterRules(enabled?: boolean): Promise<FilterRule[]> {
    let query = 'SELECT * FROM filter_rules';
    const values: any[] = [];

    if (enabled !== undefined) {
      query += ' WHERE enabled = ?';
      values.push(enabled ? 1 : 0);
    }

    const rows = this.db.prepare(query).all(...values) as any[];
    return rows.map((row) => this.mapRowToFilterRule(row));
  }

  // ========== Ingestion Job Operations ==========

  async createIngestionJob(input: CreateIngestionJobInput): Promise<IngestionJob> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const job: IngestionJob = {
      id,
      filename: input.filename,
      status: 'pending',
      total_chunks: input.total_chunks,
      processed_chunks: 0,
      greenhouse_id: input.greenhouse_id,
      created_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO ingestion_jobs (
          id, filename, status, total_chunks, processed_chunks, greenhouse_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.id,
        job.filename,
        job.status,
        job.total_chunks,
        job.processed_chunks,
        job.greenhouse_id,
        job.created_at
      );

    return job;
  }

  async getIngestionJobById(id: string): Promise<IngestionJob | null> {
    const row = this.db.prepare('SELECT * FROM ingestion_jobs WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToIngestionJob(row);
  }

  async updateIngestionJob(id: string, input: UpdateIngestionJobInput): Promise<IngestionJob> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.processed_chunks !== undefined) {
      updates.push('processed_chunks = ?');
      values.push(input.processed_chunks);
    }

    values.push(id);

    this.db.prepare(`UPDATE ingestion_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await this.getIngestionJobById(id);
    if (!updated) throw new Error(`IngestionJob ${id} not found after update`);
    return updated;
  }

  async listIngestionJobs(status?: 'pending' | 'chunking' | 'processing' | 'complete' | 'failed'): Promise<IngestionJob[]> {
    let query = 'SELECT * FROM ingestion_jobs';
    const values: any[] = [];

    if (status !== undefined) {
      query += ' WHERE status = ?';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...values) as any[];
    return rows.map((row) => this.mapRowToIngestionJob(row));
  }

  // ========== Config Operations ==========

  async getConfig(): Promise<CultivateConfig | null> {
    const row = this.db.prepare("SELECT * FROM cultivate_config WHERE id = 'singleton'").get() as any;
    if (!row) return null;

    return {
      weights: this.safeJsonParse(row.weights, {}),
      filter_rules: this.safeJsonParse(row.filter_rules, {}),
      tier1_strictness: row.tier1_strictness,
      tier2_threshold: row.tier2_threshold,
      extract_model: row.extract_model || undefined,
      cluster_model: row.cluster_model || undefined,
    };
  }

  async setConfig(config: CultivateConfig): Promise<CultivateConfig> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cultivate_config (
          id, weights, filter_rules, tier1_strictness, tier2_threshold, extract_model, cluster_model
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'singleton',
        JSON.stringify(config.weights),
        JSON.stringify(config.filter_rules),
        config.tier1_strictness,
        config.tier2_threshold,
        config.extract_model || null,
        config.cluster_model || null
      );

    return config;
  }

  // ========== Helper Mapping Methods ==========

  private mapRowToSignal(row: any): Signal {
    return {
      id: row.id,
      greenhouse_id: row.greenhouse_id,
      source_type: row.source_type,
      external_id: row.external_id,
      title: row.title,
      body: row.body,
      author: row.author,
      author_type: row.author_type,
      url: row.url || undefined,
      score: row.score,
      scoring_factors: this.safeJsonParse(row.scoring_factors, {} as ScoringFactors),
      cluster_id: row.cluster_id || undefined,
      status: row.status,
      provenance: this.safeJsonParse(row.provenance, [] as StepProvenance[]),
      tags: this.safeJsonParse(row.tags, []),
      created_at: row.created_at,
      updated_at: row.updated_at,
      linked_plan_id: row.linked_plan_id || undefined,
      intent: row.intent || undefined,
    };
  }

  private mapRowToGreenhouse(row: any): Greenhouse {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      mode: row.mode,
      keyword_require: this.safeJsonParse(row.keyword_require, []),
      keyword_exclude: this.safeJsonParse(row.keyword_exclude, []),
      source_ids: this.safeJsonParse(row.source_ids, []),
      weight_overrides: row.weight_overrides ? this.safeJsonParse(row.weight_overrides, undefined) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRowToCluster(row: any): Cluster {
    return {
      id: row.id,
      greenhouse_id: row.greenhouse_id,
      label: row.label,
      summary: row.summary,
      signal_count: row.signal_count,
      trend: row.trend,
      velocity_weekly: row.velocity_weekly,
      velocity_monthly: row.velocity_monthly,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRowToSourceConfig(row: any): SourceConfig {
    return {
      id: row.id,
      name: row.name,
      adapter_type: row.adapter_type,
      preset: row.preset || undefined,
      endpoint_template: row.endpoint_template || undefined,
      auth: this.safeJsonParse(row.auth, undefined),
      poll_interval_ms: row.poll_interval_ms,
      greenhouse_ids: this.safeJsonParse(row.greenhouse_ids, []),
      health: row.health,
      consecutive_failures: row.consecutive_failures,
      last_error: row.last_error || undefined,
      enabled: row.enabled === 1,
      created_at: row.created_at,
    };
  }

  private mapRowToFilterRule(row: any): FilterRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      condition: row.condition,
      enabled: row.enabled === 1,
      effectiveness: this.safeJsonParse(row.effectiveness, {
        signals_matched: 0,
        false_positive_rate: 0,
      }),
    };
  }

  private mapRowToIngestionJob(row: any): IngestionJob {
    return {
      id: row.id,
      filename: row.filename,
      status: row.status,
      total_chunks: row.total_chunks,
      processed_chunks: row.processed_chunks,
      greenhouse_id: row.greenhouse_id,
      created_at: row.created_at,
    };
  }

  // ========== Extraction Operations ==========

  async storeExtraction(signal_id: string, extraction: ExtractionResult): Promise<ExtractionResult> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO extractions (
          id, signal_id, keywords, summary, entities, aspects, quotes, reasoning,
          specificity, emotional_intensity, actionability, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        signal_id,
        JSON.stringify(extraction.keywords),
        extraction.summary,
        JSON.stringify(extraction.entities),
        JSON.stringify(extraction.aspects),
        JSON.stringify(extraction.quotes),
        extraction.reasoning,
        extraction.specificity,
        extraction.emotional_intensity,
        extraction.actionability,
        now,
        now
      );

    return extraction;
  }

  async getExtractionBySignalId(signal_id: string): Promise<ExtractionResult | null> {
    const row = this.db
      .prepare('SELECT * FROM extractions WHERE signal_id = ?')
      .get(signal_id) as any;
    if (!row) return null;
    return this.mapRowToExtraction(row);
  }

  private mapRowToExtraction(row: any): ExtractionResult {
    return {
      summary: row.summary,
      keywords: this.safeJsonParse(row.keywords, []),
      entities: this.safeJsonParse(row.entities, []),
      aspects: this.safeJsonParse(row.aspects, []),
      quotes: this.safeJsonParse(row.quotes, []),
      reasoning: row.reasoning,
      specificity: row.specificity,
      emotional_intensity: row.emotional_intensity,
      actionability: row.actionability,
    };
  }

  // ========== Profile Operations ==========

  async upsertProfile(input: UpsertProfileInput): Promise<Profile> {
    const now = new Date().toISOString();

    // Check if profile exists for this greenhouse + author
    const existing = this.db.prepare(
      'SELECT * FROM profiles WHERE greenhouse_id = ? AND author = ?'
    ).get(input.greenhouse_id, input.author) as any;

    if (existing) {
      // Update existing profile
      const topIntents = this.safeJsonParse<string[]>(existing.top_intents, []);
      const topClusters = this.safeJsonParse<string[]>(existing.top_clusters, []);
      const sourceDist = this.safeJsonParse<Record<string, number>>(existing.source_distribution, {});

      // Update intent tracking (keep top 5, avoid duplicates)
      if (input.intent && input.intent !== 'unclassified') {
        if (!topIntents.includes(input.intent)) topIntents.push(input.intent);
        if (topIntents.length > 5) topIntents.shift();
      }

      // Update cluster tracking (keep top 5, avoid duplicates)
      if (input.cluster_id) {
        if (!topClusters.includes(input.cluster_id)) topClusters.push(input.cluster_id);
        if (topClusters.length > 5) topClusters.shift();
      }

      // Update source distribution
      sourceDist[input.source_type] = (sourceDist[input.source_type] || 0) + 1;

      this.db.prepare(`
        UPDATE profiles SET
          signal_count = signal_count + 1,
          top_intents = ?,
          top_clusters = ?,
          source_distribution = ?,
          last_seen_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(topIntents),
        JSON.stringify(topClusters),
        JSON.stringify(sourceDist),
        now,
        now,
        existing.id
      );

      return this.getProfileById(existing.id) as Promise<Profile>;
    } else {
      // Create new profile
      const id = randomUUID();
      const topIntents = input.intent && input.intent !== 'unclassified' ? [input.intent] : [];
      const topClusters = input.cluster_id ? [input.cluster_id] : [];
      const sourceDist = { [input.source_type]: 1 };

      this.db.prepare(`
        INSERT INTO profiles (id, greenhouse_id, author, author_type, signal_count, top_intents, top_clusters, source_distribution, first_seen_at, last_seen_at, segment, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, NULL, ?, ?)
      `).run(
        id, input.greenhouse_id, input.author, input.author_type,
        JSON.stringify(topIntents), JSON.stringify(topClusters), JSON.stringify(sourceDist),
        now, now, now, now
      );

      return this.getProfileById(id) as Promise<Profile>;
    }
  }

  async listProfiles(filters: ProfileQueryFilters): Promise<Profile[]> {
    const conditions: string[] = ['greenhouse_id = ?'];
    const values: any[] = [filters.greenhouse_id];

    if (filters.segment) {
      conditions.push('segment = ?');
      values.push(filters.segment);
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    values.push(limit, offset);

    const rows = this.db
      .prepare(`SELECT * FROM profiles WHERE ${conditions.join(' AND ')} ORDER BY signal_count DESC LIMIT ? OFFSET ?`)
      .all(...values) as any[];

    return rows.map((row) => this.mapRowToProfile(row));
  }

  async getProfileById(id: string): Promise<Profile | null> {
    const row = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToProfile(row);
  }

  private mapRowToProfile(row: any): Profile {
    return {
      id: row.id,
      greenhouse_id: row.greenhouse_id,
      author: row.author,
      author_type: row.author_type,
      signal_count: row.signal_count,
      top_intents: this.safeJsonParse(row.top_intents, []),
      top_clusters: this.safeJsonParse(row.top_clusters, []),
      source_distribution: this.safeJsonParse(row.source_distribution, {}),
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      segment: row.segment ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ========== ICP Segment Operations ==========

  async createSegment(input: CreateSegmentInput): Promise<IcpSegment> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO icp_segments (id, greenhouse_id, label, description, criteria, profile_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id, input.greenhouse_id, input.label, input.description ?? null,
      JSON.stringify(input.criteria), now, now
    );

    return {
      id,
      greenhouse_id: input.greenhouse_id,
      label: input.label,
      description: input.description ?? null,
      criteria: input.criteria,
      profile_count: 0,
      created_at: now,
      updated_at: now,
    };
  }

  async listSegments(greenhouse_id: string): Promise<IcpSegment[]> {
    const rows = this.db
      .prepare('SELECT * FROM icp_segments WHERE greenhouse_id = ? ORDER BY profile_count DESC')
      .all(greenhouse_id) as any[];

    return rows.map((row) => this.mapRowToSegment(row));
  }

  async assignProfileSegment(profile_id: string, segment: string | null): Promise<void> {
    this.db.prepare('UPDATE profiles SET segment = ?, updated_at = ? WHERE id = ?')
      .run(segment, new Date().toISOString(), profile_id);
  }

  async updateSegmentCount(segment_id: string, count: number): Promise<void> {
    this.db.prepare('UPDATE icp_segments SET profile_count = ?, updated_at = ? WHERE id = ?')
      .run(count, new Date().toISOString(), segment_id);
  }

  private mapRowToSegment(row: any): IcpSegment {
    return {
      id: row.id,
      greenhouse_id: row.greenhouse_id,
      label: row.label,
      description: row.description ?? null,
      criteria: this.safeJsonParse(row.criteria, {}),
      profile_count: row.profile_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
