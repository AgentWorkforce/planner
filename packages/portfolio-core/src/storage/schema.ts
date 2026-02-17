/**
 * Schema DDL for portfolio.db
 */

export const PORTFOLIO_SCHEMA = `
  CREATE TABLE IF NOT EXISTS portfolio_decisions (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('initiative', 'plan', 'portfolio')),
    entity_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT NOT NULL,
    alternatives TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL CHECK(source IN ('human', 'ai-suggested')),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_decisions_entity ON portfolio_decisions(entity_type, entity_id);

  CREATE TABLE IF NOT EXISTS health_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('initiative', 'plan')),
    entity_id TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    signals_json TEXT NOT NULL,
    staleness_days INTEGER NOT NULL,
    computed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_health_entity ON health_snapshots(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_health_computed ON health_snapshots(computed_at DESC);
`;
