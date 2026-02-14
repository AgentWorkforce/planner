/**
 * Cluster creation module
 *
 * Provides a simplified interface for creating new clusters with AI-recommended names and summaries.
 * Used when the clustering model recommends creating a new cluster for a signal.
 */

import type { Cluster } from '../domain/types.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { CreateClusterInput } from '../storage/interface.js';

/**
 * Context required for cluster creation
 */
export interface CreateClusterContext {
  /** Storage instance for persisting the cluster */
  storage: CultivateStorage;

  /** Greenhouse ID for the cluster */
  greenhouseId: string;

  /** Cluster name/label */
  name: string;

  /** AI-generated summary of the cluster theme */
  summary: string;

  /** Initial signal ID that triggered cluster creation */
  initialSignalId: string;
}

/**
 * Create a new cluster with Greenhouse association and initial signal
 *
 * This function creates a new cluster record in storage with:
 * - Greenhouse association (ensures signal isolation)
 * - AI-recommended name and summary
 * - Initial signal count of 1 (the signal that triggered cluster creation)
 * - Default stable trend (will be updated as more signals arrive)
 * - Created timestamp
 *
 * The cluster will have:
 * - Generated UUID for id
 * - signal_count = 1 (initial cluster starts with the first signal)
 * - trend = 'stable' (default for new clusters, will evolve with data)
 * - velocity_weekly = 0 (no velocity data for new cluster)
 * - velocity_monthly = 0 (no velocity data for new cluster)
 * - created_at = current timestamp
 * - updated_at = current timestamp
 *
 * @param context - Cluster creation context with storage, greenhouse ID, and metadata
 * @returns Newly created cluster with generated ID and timestamp
 *
 * @example
 * ```typescript
 * const cluster = await createCluster({
 *   storage: storageInstance,
 *   greenhouseId: 'gh-456',
 *   name: 'API Performance Issues',
 *   summary: 'Cluster of signals discussing API response time degradation',
 *   initialSignalId: 'sig-123',
 * });
 *
 * console.log(`Created cluster: ${cluster.id} (${cluster.label})`);
 * ```
 */
export async function createCluster(context: CreateClusterContext): Promise<Cluster> {
  const { storage, greenhouseId, name, summary, initialSignalId } = context;

  // Build the input for storage.createCluster
  const input: CreateClusterInput = {
    greenhouse_id: greenhouseId,
    label: name,
    summary,
    signal_count: 1, // New cluster starts with initial signal
    trend: 'stable', // Default trend for new clusters
    velocity_weekly: 0,
    velocity_monthly: 0,
  };

  // Create the cluster in storage
  const cluster = await storage.createCluster(input);

  return cluster;
}
