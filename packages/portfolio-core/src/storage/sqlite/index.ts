/**
 * SQLite implementation of PortfolioStorage
 */

import { BaseSqliteStorage } from '@plannr/storage-base';
import type { PortfolioDecision, HealthSnapshot, HealthSignals } from '../../domain/types.js';
import type { PortfolioStorage } from '../interface.js';
import { PORTFOLIO_SCHEMA } from '../schema.js';

/**
 * Row interfaces matching SQL schema
 */
interface DecisionRow {
  id: string;
  entity_type: string;
  entity_id: string;
  decision: string;
  rationale: string;
  alternatives: string;
  source: string;
  created_at: string;
}

interface HealthSnapshotRow {
  id: string;
  entity_type: string;
  entity_id: string;
  overall_score: number;
  signals_json: string;
  staleness_days: number;
  computed_at: string;
}

/**
 * SQLite storage implementation for Portfolio domain
 */
export class SqlitePortfolioStorage extends BaseSqliteStorage implements PortfolioStorage {
  /**
   * Initialize database schema with tables and indexes
   */
  protected initializeSchema(): void {
    this.db.exec(PORTFOLIO_SCHEMA);
  }

  // ========== Decision Operations ==========

  createDecision(decision: PortfolioDecision): void {
    this.db
      .prepare(
        `INSERT INTO portfolio_decisions (
          id, entity_type, entity_id, decision, rationale, alternatives, source, created_at
        ) VALUES (@id, @entity_type, @entity_id, @decision, @rationale, @alternatives, @source, @created_at)`
      )
      .run({
        id: decision.id,
        entity_type: decision.entity_type,
        entity_id: decision.entity_id,
        decision: decision.decision,
        rationale: decision.rationale,
        alternatives: JSON.stringify(decision.alternatives),
        source: decision.source,
        created_at: decision.created_at,
      });
  }

  getDecision(id: string): PortfolioDecision | null {
    const row = this.db
      .prepare('SELECT * FROM portfolio_decisions WHERE id = @id')
      .get({ id }) as DecisionRow | undefined;

    if (!row) return null;

    return this.mapRowToDecision(row);
  }

  listDecisions(filter?: { entity_type?: string; entity_id?: string }): PortfolioDecision[] {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (filter?.entity_type) {
      conditions.push('entity_type = @entity_type');
      params.entity_type = filter.entity_type;
    }

    if (filter?.entity_id) {
      conditions.push('entity_id = @entity_id');
      params.entity_id = filter.entity_id;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM portfolio_decisions ${whereClause} ORDER BY created_at DESC`;

    const rows = this.db.prepare(query).all(params) as DecisionRow[];

    return rows.map((row) => this.mapRowToDecision(row));
  }

  // ========== Health Snapshot Operations ==========

  saveHealthSnapshot(snapshot: HealthSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO health_snapshots (
          id, entity_type, entity_id, overall_score, signals_json, staleness_days, computed_at
        ) VALUES (@id, @entity_type, @entity_id, @overall_score, @signals_json, @staleness_days, @computed_at)`
      )
      .run({
        id: snapshot.id,
        entity_type: snapshot.entity_type,
        entity_id: snapshot.entity_id,
        overall_score: snapshot.overall_score,
        signals_json: JSON.stringify(snapshot.signals),
        staleness_days: snapshot.staleness_days,
        computed_at: snapshot.computed_at,
      });
  }

  getLatestHealthSnapshot(entityType: string, entityId: string): HealthSnapshot | null {
    const row = this.db
      .prepare(
        `SELECT * FROM health_snapshots
         WHERE entity_type = @entity_type AND entity_id = @entity_id
         ORDER BY computed_at DESC
         LIMIT 1`
      )
      .get({ entity_type: entityType, entity_id: entityId }) as HealthSnapshotRow | undefined;

    if (!row) return null;

    return this.mapRowToHealthSnapshot(row);
  }

  getHealthHistory(entityType: string, entityId: string, limit: number = 10): HealthSnapshot[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM health_snapshots
         WHERE entity_type = @entity_type AND entity_id = @entity_id
         ORDER BY computed_at DESC
         LIMIT @limit`
      )
      .all({ entity_type: entityType, entity_id: entityId, limit }) as HealthSnapshotRow[];

    return rows.map((row) => this.mapRowToHealthSnapshot(row));
  }

  // ========== Helper Mapping Methods ==========

  private mapRowToDecision(row: DecisionRow): PortfolioDecision {
    return {
      id: row.id,
      entity_type: row.entity_type as 'initiative' | 'plan' | 'portfolio',
      entity_id: row.entity_id,
      decision: row.decision,
      rationale: row.rationale,
      alternatives: this.safeJsonParse(row.alternatives, []),
      source: row.source as 'human' | 'ai-suggested',
      created_at: row.created_at,
    };
  }

  private mapRowToHealthSnapshot(row: HealthSnapshotRow): HealthSnapshot {
    return {
      id: row.id,
      entity_type: row.entity_type as 'initiative' | 'plan',
      entity_id: row.entity_id,
      overall_score: row.overall_score,
      signals: this.safeJsonParse<HealthSignals>(row.signals_json, {
        recency: 0,
        velocity: 0,
        completeness: 0,
        attention: 0,
        decision_density: 0,
        external_pressure: 0,
        execution_health: 0,
      }),
      staleness_days: row.staleness_days,
      computed_at: row.computed_at,
    };
  }
}
