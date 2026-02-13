/**
 * Cultivate API routes
 */

import { Router } from 'express';
import type { CultivateContext } from './types.js';

/**
 * Create Express router for Cultivate API
 *
 * @param context - Initialized Cultivate context with all dependencies
 * @returns Express Router ready for mounting
 */
export function createCultivateRouter(context: CultivateContext): Router {
  const router = Router();

  /**
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'cultivate',
      timestamp: new Date().toISOString(),
    });
  });

  // TODO: Add more routes as needed for:
  // - Greenhouse management
  // - Signal polling/ingestion
  // - Document processing
  // - Clustering and trend detection
  // - SSE event streaming

  return router;
}
