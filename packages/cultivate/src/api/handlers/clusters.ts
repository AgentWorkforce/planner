/**
 * Cluster API handlers
 * Handles Cluster read operations with Signal aggregation
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import { ListClustersQuerySchema } from '../schemas.js';

/**
 * Create Cluster handler factory
 *
 * @param storage - Cultivate storage instance
 * @returns Object with Cluster handler functions
 */
export function createClusterHandlers(storage: CultivateStorage) {
  /**
   * List clusters with optional greenhouse filter
   * GET /clusters?greenhouse_id=...
   *
   * Note: Clusters MUST be scoped to a greenhouse. If no greenhouse_id provided,
   * returns empty array (clusters cannot be listed globally).
   */
  const list: RequestHandler = async (req, res, next) => {
    try {
      // Parse and validate query parameters
      const query = ListClustersQuerySchema.parse(req.query);

      // If no greenhouse_id provided, return empty array
      // Clusters must be scoped to a greenhouse
      if (!query.greenhouse_id) {
        res.json({ data: [] });
        return;
      }

      // Fetch clusters for the greenhouse
      let clusters = await storage.listClustersByGreenhouse(query.greenhouse_id);

      // Sort by signal_count descending (highest activity first)
      clusters = clusters.sort((a, b) => b.signal_count - a.signal_count);

      res.json({ data: clusters });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get a single cluster by ID with its signals
   * GET /clusters/:id
   *
   * Returns cluster with embedded signals array (up to 100 signals)
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const cluster = await storage.getClusterById(id);

      if (!cluster) {
        throw notFound('Cluster');
      }

      // Fetch signals for this cluster
      const signals = await storage.listSignals({
        cluster_id: id,
        limit: 100,
        offset: 0,
      });

      // Return cluster with embedded signals
      res.json({
        data: {
          ...cluster,
          signals,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  return {
    list,
    get,
  };
}
