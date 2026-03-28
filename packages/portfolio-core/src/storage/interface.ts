import type { PortfolioDecision, HealthSnapshot } from '../domain/types.js';

/**
 * Portfolio storage interface
 */
export interface PortfolioStorage {
  // Decisions
  createDecision(decision: PortfolioDecision): void;
  getDecision(id: string): PortfolioDecision | null;
  listDecisions(filter?: { entity_type?: string; entity_id?: string }): PortfolioDecision[];

  // Health snapshots
  saveHealthSnapshot(snapshot: HealthSnapshot): void;
  getLatestHealthSnapshot(entityType: string, entityId: string): HealthSnapshot | null;
  getHealthHistory(entityType: string, entityId: string, limit?: number): HealthSnapshot[];

  // Lifecycle
  close(): void;
}
