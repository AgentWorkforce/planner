/**
 * Tests for cluster creation functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { SqliteCultivateStorage } from '../storage/sqlite.js';
import { createCluster } from './create.js';
import type { CreateClusterContext } from './create.js';

describe('createCluster', () => {
  let storage: SqliteCultivateStorage;
  let greenhouseId: string;

  beforeEach(() => {
    // Use in-memory database for testing
    const db = new Database(':memory:');
    storage = new SqliteCultivateStorage(db);

    // Create a test greenhouse
    greenhouseId = randomUUID();
    db.exec(`
      INSERT INTO greenhouses (id, name, description, mode, keyword_require, keyword_exclude, source_ids, created_at, updated_at)
      VALUES ('${greenhouseId}', 'Test Greenhouse', NULL, 'refinement', '[]', '[]', '[]', datetime('now'), datetime('now'))
    `);
  });

  it('should create a new cluster with correct fields', async () => {
    const context: CreateClusterContext = {
      storage,
      greenhouseId,
      name: 'API Performance Issues',
      summary: 'Cluster of signals discussing API response time degradation',
      initialSignalId: 'sig-123',
    };

    const cluster = await createCluster(context);

    expect(cluster).toBeDefined();
    expect(cluster.id).toBeDefined();
    expect(cluster.greenhouse_id).toBe(greenhouseId);
    expect(cluster.label).toBe('API Performance Issues');
    expect(cluster.summary).toBe('Cluster of signals discussing API response time degradation');
    expect(cluster.signal_count).toBe(1);
    expect(cluster.trend).toBe('stable');
    expect(cluster.velocity_weekly).toBe(0);
    expect(cluster.velocity_monthly).toBe(0);
    expect(cluster.created_at).toBeDefined();
    expect(cluster.updated_at).toBeDefined();
  });

  it('should generate a unique UUID for cluster id', async () => {
    const context1: CreateClusterContext = {
      storage,
      greenhouseId,
      name: 'Cluster 1',
      summary: 'First cluster',
      initialSignalId: 'sig-1',
    };

    const context2: CreateClusterContext = {
      storage,
      greenhouseId,
      name: 'Cluster 2',
      summary: 'Second cluster',
      initialSignalId: 'sig-2',
    };

    const cluster1 = await createCluster(context1);
    const cluster2 = await createCluster(context2);

    expect(cluster1.id).not.toBe(cluster2.id);
    expect(cluster1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(cluster2.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should persist cluster to storage and be retrievable', async () => {
    const context: CreateClusterContext = {
      storage,
      greenhouseId,
      name: 'Persistent Cluster',
      summary: 'This cluster should be stored',
      initialSignalId: 'sig-456',
    };

    const created = await createCluster(context);
    const retrieved = await storage.getClusterById(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.label).toBe('Persistent Cluster');
    expect(retrieved?.summary).toBe('This cluster should be stored');
  });

  it('should create cluster with greenhouse association', async () => {
    const context: CreateClusterContext = {
      storage,
      greenhouseId,
      name: 'Associated Cluster',
      summary: 'Cluster with greenhouse',
      initialSignalId: 'sig-789',
    };

    const cluster = await createCluster(context);
    const clusters = await storage.listClustersByGreenhouse(greenhouseId);

    expect(clusters).toContainEqual(cluster);
    expect(clusters.length).toBe(1);
  });

  it('should set created_at and updated_at timestamps', async () => {
    const beforeCreation = new Date();

    const context: CreateClusterContext = {
      storage,
      greenhouseId,
      name: 'Timestamped Cluster',
      summary: 'Cluster with timestamps',
      initialSignalId: 'sig-999',
    };

    const cluster = await createCluster(context);
    const afterCreation = new Date();

    const createdAt = new Date(cluster.created_at);
    const updatedAt = new Date(cluster.updated_at);

    expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });
});
