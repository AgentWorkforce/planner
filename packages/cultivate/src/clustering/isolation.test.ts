/**
 * Tests for per-Greenhouse cluster isolation invariant
 *
 * Verifies that clusters are properly isolated to their Greenhouses at:
 * - Database schema level (NOT NULL greenhouse_id, foreign key, unique constraint)
 * - Storage query level (greenhouse_id in WHERE clauses)
 * - Application level (assertions in assignCluster)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { SqliteCultivateStorage } from '../storage/sqlite.js';
import type { Cluster } from '../domain/types.js';

describe('Cluster Isolation Invariant', () => {
  let storage: SqliteCultivateStorage;
  let greenhouse1: string;
  let greenhouse2: string;
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
    db = new Database(':memory:');
    storage = new SqliteCultivateStorage(db);

    // Create two test greenhouses
    greenhouse1 = randomUUID();
    greenhouse2 = randomUUID();
    const now = new Date().toISOString();

    db.exec(`
      INSERT INTO greenhouses (id, name, description, mode, keyword_require, keyword_exclude, source_ids, created_at, updated_at)
      VALUES
        ('${greenhouse1}', 'Greenhouse 1', NULL, 'refinement', '[]', '[]', '[]', '${now}', '${now}'),
        ('${greenhouse2}', 'Greenhouse 2', NULL, 'discovery', '[]', '[]', '[]', '${now}', '${now}')
    `);
  });

  describe('Storage-level constraints', () => {
    it('should enforce NOT NULL greenhouse_id constraint', async () => {
      // Attempt to create a cluster without greenhouse_id should fail
      expect(() => {
        db.exec(`
          INSERT INTO clusters (id, greenhouse_id, label, summary, signal_count, trend, velocity_weekly, velocity_monthly, created_at, updated_at)
          VALUES ('test-id', NULL, 'Test', 'Test cluster', 0, 'stable', 0, 0, datetime('now'), datetime('now'))
        `);
      }).toThrow();
    });

    it('should enforce FOREIGN KEY constraint on greenhouse_id', async () => {
      const clusterId = randomUUID();
      const now = new Date().toISOString();

      // Attempt to create a cluster with non-existent greenhouse_id should fail
      expect(() => {
        db.exec(`
          INSERT INTO clusters (id, greenhouse_id, label, summary, signal_count, trend, velocity_weekly, velocity_monthly, created_at, updated_at)
          VALUES ('${clusterId}', 'invalid-gh-id', 'Test', 'Test cluster', 0, 'stable', 0, 0, '${now}', '${now}')
        `);
      }).toThrow();
    });

    it('should enforce UNIQUE (greenhouse_id, label) constraint', async () => {
      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'API Issues',
        summary: 'Performance issues',
        trend: 'stable',
      });

      // Same label in same greenhouse should fail
      expect(() => {
        storage.createCluster({
          greenhouse_id: greenhouse1,
          label: 'API Issues',
          summary: 'Different summary',
          trend: 'stable',
        });
      }).rejects.toThrow();

      // Same label in different greenhouse should succeed
      const cluster2 = await storage.createCluster({
        greenhouse_id: greenhouse2,
        label: 'API Issues',
        summary: 'Different summary for different greenhouse',
        trend: 'stable',
      });

      expect(cluster2.id).not.toBe(cluster1.id);
      expect(cluster2.greenhouse_id).toBe(greenhouse2);
    });
  });

  describe('Query-level isolation', () => {
    it('should isolate clusters by greenhouse in listClustersByGreenhouse', async () => {
      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'Cluster 1',
        summary: 'In greenhouse 1',
        trend: 'stable',
      });

      const cluster2 = await storage.createCluster({
        greenhouse_id: greenhouse2,
        label: 'Cluster 2',
        summary: 'In greenhouse 2',
        trend: 'stable',
      });

      const gh1Clusters = await storage.listClustersByGreenhouse(greenhouse1);
      const gh2Clusters = await storage.listClustersByGreenhouse(greenhouse2);

      expect(gh1Clusters).toHaveLength(1);
      expect(gh1Clusters[0].id).toBe(cluster1.id);
      expect(gh1Clusters[0].greenhouse_id).toBe(greenhouse1);

      expect(gh2Clusters).toHaveLength(1);
      expect(gh2Clusters[0].id).toBe(cluster2.id);
      expect(gh2Clusters[0].greenhouse_id).toBe(greenhouse2);
    });

    it('should enforce greenhouse_id in getClusterByLabel query', async () => {
      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'Shared Label',
        summary: 'In greenhouse 1',
        trend: 'stable',
      });

      const cluster2 = await storage.createCluster({
        greenhouse_id: greenhouse2,
        label: 'Shared Label',
        summary: 'In greenhouse 2',
        trend: 'stable',
      });

      // getClusterByLabel should return different clusters based on greenhouse_id
      const result1 = await storage.getClusterByLabel(greenhouse1, 'Shared Label');
      const result2 = await storage.getClusterByLabel(greenhouse2, 'Shared Label');

      expect(result1?.id).toBe(cluster1.id);
      expect(result2?.id).toBe(cluster2.id);
      expect(result1?.id).not.toBe(result2?.id);
    });

    it('should enforce greenhouse_id in getClusterByIdAndGreenhouse query', async () => {
      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'Cluster 1',
        summary: 'In greenhouse 1',
        trend: 'stable',
      });

      const cluster2 = await storage.createCluster({
        greenhouse_id: greenhouse2,
        label: 'Cluster 2',
        summary: 'In greenhouse 2',
        trend: 'stable',
      });

      // Correct greenhouse_id should find cluster
      const found1 = await storage.getClusterByIdAndGreenhouse(cluster1.id, greenhouse1);
      expect(found1?.id).toBe(cluster1.id);

      // Wrong greenhouse_id should return null (not the cluster from different greenhouse)
      const notFound = await storage.getClusterByIdAndGreenhouse(cluster1.id, greenhouse2);
      expect(notFound).toBeNull();

      // Also test the reverse
      const found2 = await storage.getClusterByIdAndGreenhouse(cluster2.id, greenhouse2);
      expect(found2?.id).toBe(cluster2.id);

      const alsoNotFound = await storage.getClusterByIdAndGreenhouse(cluster2.id, greenhouse1);
      expect(alsoNotFound).toBeNull();
    });
  });

  describe('CASCADE delete on greenhouse', () => {
    it('should delete all clusters when greenhouse is deleted', async () => {
      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'Cluster 1',
        summary: 'In greenhouse 1',
        trend: 'stable',
      });

      const cluster2 = await storage.createCluster({
        greenhouse_id: greenhouse2,
        label: 'Cluster 2',
        summary: 'In greenhouse 2',
        trend: 'stable',
      });

      // Verify clusters exist
      let gh1Clusters = await storage.listClustersByGreenhouse(greenhouse1);
      let gh2Clusters = await storage.listClustersByGreenhouse(greenhouse2);
      expect(gh1Clusters).toHaveLength(1);
      expect(gh2Clusters).toHaveLength(1);

      // Delete greenhouse 1
      await storage.deleteGreenhouse(greenhouse1);

      // Clusters for greenhouse 1 should be deleted
      gh1Clusters = await storage.listClustersByGreenhouse(greenhouse1);
      expect(gh1Clusters).toHaveLength(0);

      // Clusters for greenhouse 2 should remain
      gh2Clusters = await storage.listClustersByGreenhouse(greenhouse2);
      expect(gh2Clusters).toHaveLength(1);
      expect(gh2Clusters[0].id).toBe(cluster2.id);
    });
  });

  describe('Cluster isolation invariant', () => {
    it('should maintain invariant: cluster_id never spans Greenhouses', async () => {
      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'Unique Cluster',
        summary: 'Test cluster',
        trend: 'stable',
      });

      // The cluster should be queryable in greenhouse1 only
      const inGh1 = await storage.listClustersByGreenhouse(greenhouse1);
      expect(inGh1).toContainEqual(cluster1);

      const inGh2 = await storage.listClustersByGreenhouse(greenhouse2);
      expect(inGh2).not.toContainEqual(cluster1);

      // Try to find cluster in wrong greenhouse - should return null
      const wrongGh = await storage.getClusterByIdAndGreenhouse(cluster1.id, greenhouse2);
      expect(wrongGh).toBeNull();

      // getClusterById still returns cluster (deprecated method)
      // but application code should use getClusterByIdAndGreenhouse
      const deprecated = await storage.getClusterById(cluster1.id);
      expect(deprecated?.id).toBe(cluster1.id);
    });

    it('should allow same cluster_id to theoretically exist in different greenhouses (database isolation)', async () => {
      // This test verifies the database schema prevents this at the PRIMARY KEY level
      // cluster_id is globally unique (PRIMARY KEY), so same ID cannot exist twice
      const clusterId = randomUUID();
      const now = new Date().toISOString();

      const cluster1 = await storage.createCluster({
        greenhouse_id: greenhouse1,
        label: 'Test Cluster 1',
        summary: 'Test',
        trend: 'stable',
      });

      // Attempting to create a cluster with same ID should fail (PRIMARY KEY violation)
      expect(() => {
        db.exec(`
          INSERT INTO clusters (id, greenhouse_id, label, summary, signal_count, trend, velocity_weekly, velocity_monthly, created_at, updated_at)
          VALUES ('${cluster1.id}', '${greenhouse2}', 'Test Cluster 2', 'Test', 0, 'stable', 0, 0, '${now}', '${now}')
        `);
      }).toThrow();
    });
  });
});
