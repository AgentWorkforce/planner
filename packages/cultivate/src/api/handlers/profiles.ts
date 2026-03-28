/**
 * Profile and ICP Segment API handlers
 */

import type { RequestHandler } from 'express';
import type { CultivateStorage } from '../../storage/interface.js';
import { generateSegments } from '../../profiles/segment-engine.js';

/**
 * Create Profile handler factory
 *
 * @param storage - Cultivate storage instance
 * @returns Object with Profile and Segment handler functions
 */
export function createProfileHandlers(storage: CultivateStorage) {
  /**
   * List profiles with optional filtering
   * GET /profiles?greenhouse_id=...&segment=...&limit=...&offset=...
   */
  const list: RequestHandler = async (req, res, next) => {
    try {
      const greenhouse_id = req.query.greenhouse_id as string;
      if (!greenhouse_id) {
        res.json({ data: [] });
        return;
      }
      const segment = req.query.segment as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const profiles = await storage.listProfiles({ greenhouse_id, segment, limit, offset });
      res.json({ data: profiles });
    } catch (err) {
      next(err);
    }
  };

  /**
   * List ICP segments for a greenhouse
   * GET /profiles/segments?greenhouse_id=...
   */
  const listSegments: RequestHandler = async (req, res, next) => {
    try {
      const greenhouse_id = req.query.greenhouse_id as string;
      if (!greenhouse_id) {
        res.json({ data: [] });
        return;
      }
      const segments = await storage.listSegments(greenhouse_id);
      res.json({ data: segments });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Run segmentation engine on a greenhouse
   * POST /profiles/segments/generate { greenhouse_id }
   */
  const generateSegmentsHandler: RequestHandler = async (req, res, next) => {
    try {
      const { greenhouse_id } = req.body;
      if (!greenhouse_id) {
        res.status(400).json({ error: 'greenhouse_id is required' });
        return;
      }
      const result = await generateSegments(storage, greenhouse_id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  return {
    list,
    listSegments,
    generateSegments: generateSegmentsHandler,
  };
}
