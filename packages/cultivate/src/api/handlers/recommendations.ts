/**
 * Recommendation handlers
 */

import type { RequestHandler } from 'express';
import { badRequest } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import { RecommendationEngine } from '../../recommender/index.js';

/**
 * Create recommendation handlers with storage and API key dependency injection
 */
export function createRecommendationHandlers(
  storage: CultivateStorage,
  anthropicApiKey?: string
) {
  const engine = new RecommendationEngine(storage, anthropicApiKey);

  /**
   * GET /recommendations
   * Get AI-powered recommendations for a greenhouse
   * Requires greenhouse_id query parameter
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const greenhouseId = req.query.greenhouse_id;

      if (!greenhouseId || typeof greenhouseId !== 'string') {
        throw badRequest('greenhouse_id query parameter is required');
      }

      const recommendations = await engine.getRecommendations(greenhouseId);

      res.json({ data: recommendations });
    } catch (err) {
      next(err);
    }
  };

  return {
    get,
  };
}
