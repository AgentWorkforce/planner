/**
 * Greenhouse CRUD handlers
 */

import type { RequestHandler } from 'express';
import { notFound, badRequest } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import {
  CreateGreenhouseSchema,
  UpdateGreenhouseSchema,
  type CreateGreenhouseRequest,
  type UpdateGreenhouseRequest,
} from '../schemas.js';

/**
 * Create greenhouse handlers with storage dependency injection
 */
export function createGreenhouseHandlers(storage: CultivateStorage) {
  /**
   * POST /greenhouses
   * Create a new greenhouse
   */
  const create: RequestHandler = async (req, res, next) => {
    try {
      const input: CreateGreenhouseRequest = CreateGreenhouseSchema.parse(req.body);

      const greenhouse = await storage.createGreenhouse({
        name: input.name,
        description: input.description,
        mode: input.mode,
        keyword_require: input.keyword_require,
        keyword_exclude: input.keyword_exclude,
        source_ids: input.source_ids,
        weight_overrides: input.weight_overrides,
      });

      res.status(201).json({ data: greenhouse });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /greenhouses
   * List all greenhouses
   */
  const list: RequestHandler = async (_req, res, next) => {
    try {
      const greenhouses = await storage.listGreenhouses();
      res.json({ data: greenhouses });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /greenhouses/:id
   * Get greenhouse by ID
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const greenhouse = await storage.getGreenhouseById(id);

      if (!greenhouse) {
        throw notFound('Greenhouse');
      }

      res.json({ data: greenhouse });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /greenhouses/:id
   * Update greenhouse
   */
  const update: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const input: UpdateGreenhouseRequest = UpdateGreenhouseSchema.parse(req.body);

      // Check if greenhouse exists
      const existing = await storage.getGreenhouseById(id);
      if (!existing) {
        throw notFound('Greenhouse');
      }

      const greenhouse = await storage.updateGreenhouse(id, {
        name: input.name,
        description: input.description,
        mode: input.mode,
        keyword_require: input.keyword_require,
        keyword_exclude: input.keyword_exclude,
        source_ids: input.source_ids,
        weight_overrides: input.weight_overrides,
      });

      res.json({ data: greenhouse });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /greenhouses/:id
   * Delete greenhouse (only if no active signals)
   */
  const remove: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      // Check if greenhouse exists
      const existing = await storage.getGreenhouseById(id);
      if (!existing) {
        throw notFound('Greenhouse');
      }

      // Check for active signals
      const signals = await storage.listSignals({
        greenhouse_id: id,
        limit: 1,
        offset: 0,
      });

      if (signals.length > 0) {
        throw badRequest('Cannot delete greenhouse with active signals');
      }

      await storage.deleteGreenhouse(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  return {
    create,
    list,
    get,
    update,
    remove,
  };
}
