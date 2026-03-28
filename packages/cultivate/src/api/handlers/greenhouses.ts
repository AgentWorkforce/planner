/**
 * Greenhouse CRUD + quick-start handlers
 */

import type { RequestHandler } from 'express';
import { notFound, badRequest } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import type { SourceConfig } from '../../domain/types.js';
import {
  CreateGreenhouseSchema,
  UpdateGreenhouseSchema,
  QuickStartSchema,
  type CreateGreenhouseRequest,
  type UpdateGreenhouseRequest,
  type QuickStartRequest,
} from '../schemas.js';
import { getPresetById } from '../../presets/catalog.js';

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

  /**
   * POST /greenhouses/quick-start
   * Create a greenhouse + source configs from selected presets in one call
   */
  const quickStart: RequestHandler = async (req, res, next) => {
    try {
      const input: QuickStartRequest = QuickStartSchema.parse(req.body);

      // Validate all preset IDs exist before creating anything
      const resolvedPresets = input.preset_ids.map((presetId) => {
        const entry = getPresetById(presetId);
        if (!entry) {
          throw badRequest(`Unknown preset ID: "${presetId}"`);
        }
        return entry;
      });

      // 1. Create the greenhouse with empty source_ids (will update after sources created)
      const greenhouse = await storage.createGreenhouse({
        name: input.name,
        mode: 'discovery',
        keyword_require: [],
        keyword_exclude: [],
        source_ids: [],
      });

      // 2. Create a source config for each preset
      const sources: SourceConfig[] = [];
      for (const entry of resolvedPresets) {
        const preset = entry.preset;
        const pollInterval =
          typeof preset.defaults.poll_interval_ms === 'number'
            ? preset.defaults.poll_interval_ms
            : 600000; // fallback: 10 minutes

        const source = await storage.createSourceConfig({
          name: preset.name,
          adapter_type: preset.adapter_type,
          preset: entry.id,
          poll_interval_ms: pollInterval,
          greenhouse_ids: [greenhouse.id],
          enabled: true,
        });

        sources.push(source);
      }

      // 3. Update the greenhouse's source_ids with all created source config IDs
      const sourceIds = sources.map((s) => s.id);
      const updatedGreenhouse = await storage.updateGreenhouse(greenhouse.id, {
        source_ids: sourceIds,
      });

      res.status(201).json({ data: { greenhouse: updatedGreenhouse, sources } });
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
    quickStart,
  };
}
