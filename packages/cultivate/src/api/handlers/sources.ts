/**
 * Source config CRUD + presets catalog handlers
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import {
  CreateSourceConfigSchema,
  UpdateSourceConfigSchema,
  type CreateSourceConfigRequest,
  type UpdateSourceConfigRequest,
} from '../schemas.js';
import {
  createSupportTicketPreset,
  createSurveyPreset,
  createInterviewPreset,
  createSlackPreset,
  createDiscordPreset,
  createTeamsPreset,
  createCRMNotesPreset,
  createSalesCallPreset,
  createRedditPreset,
  createHackerNewsPreset,
  createTwitterPreset,
  createRSSPreset,
  createWebScraperPreset,
} from '../../presets/index.js';

/**
 * Create source config handlers with storage dependency injection
 */
export function createSourceHandlers(storage: CultivateStorage) {
  /**
   * POST /sources
   * Create a new source configuration
   */
  const create: RequestHandler = async (req, res, next) => {
    try {
      const input: CreateSourceConfigRequest = CreateSourceConfigSchema.parse(req.body);

      const source = await storage.createSourceConfig({
        name: input.name,
        adapter_type: input.adapter_type,
        preset: input.preset,
        endpoint_template: input.endpoint_template,
        auth: input.auth,
        poll_interval_ms: input.poll_interval_ms,
        greenhouse_ids: input.greenhouse_ids,
        enabled: input.enabled,
      });

      res.status(201).json({ data: source });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /sources
   * List all source configurations
   */
  const list: RequestHandler = async (_req, res, next) => {
    try {
      const sources = await storage.listSourceConfigs();
      res.json({ data: sources });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /sources/:id
   * Get source configuration by ID
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const source = await storage.getSourceConfigById(id);

      if (!source) {
        throw notFound('Source configuration');
      }

      res.json({ data: source });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /sources/:id
   * Update source configuration
   */
  const update: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const input: UpdateSourceConfigRequest = UpdateSourceConfigSchema.parse(req.body);

      // Check if source exists
      const existing = await storage.getSourceConfigById(id);
      if (!existing) {
        throw notFound('Source configuration');
      }

      const source = await storage.updateSourceConfig(id, {
        name: input.name,
        adapter_type: input.adapter_type,
        preset: input.preset,
        endpoint_template: input.endpoint_template,
        auth: input.auth,
        poll_interval_ms: input.poll_interval_ms,
        greenhouse_ids: input.greenhouse_ids,
        enabled: input.enabled,
      });

      res.json({ data: source });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /sources/:id
   * Delete source configuration
   */
  const remove: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      // Check if source exists
      const existing = await storage.getSourceConfigById(id);
      if (!existing) {
        throw notFound('Source configuration');
      }

      await storage.deleteSourceConfig(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /presets
   * Get all available source presets
   */
  const presets: RequestHandler = async (_req, res, next) => {
    try {
      // Build catalog by calling all preset factory functions
      const catalog = [
        // Tier 1: Direct feedback / structured sources
        createSupportTicketPreset(),
        createSurveyPreset(),
        createInterviewPreset(),

        // Tier 3: Conversational context
        createSlackPreset(),
        createDiscordPreset(),
        createTeamsPreset(),
        createCRMNotesPreset(),
        createSalesCallPreset(),

        // Tier 4: Public / aggregated sources
        createRedditPreset(),
        createHackerNewsPreset(),
        createTwitterPreset(),
        createRSSPreset(),
        createWebScraperPreset(),
      ];

      res.json({ data: catalog });
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
    presets,
  };
}
