/**
 * Filter rule CRUD handlers
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import {
  CreateFilterRuleSchema,
  UpdateFilterRuleSchema,
  type CreateFilterRuleRequest,
  type UpdateFilterRuleRequest,
} from '../schemas.js';

/**
 * Create filter rule handlers with storage dependency injection
 */
export function createFilterRuleHandlers(storage: CultivateStorage) {
  /**
   * POST /filter-rules
   * Create a new filter rule
   */
  const create: RequestHandler = async (req, res, next) => {
    try {
      const input: CreateFilterRuleRequest = CreateFilterRuleSchema.parse(req.body);

      const rule = await storage.createFilterRule({
        name: input.name,
        description: input.description,
        type: input.type,
        condition: input.condition,
        enabled: input.enabled,
      });

      res.status(201).json({ data: rule });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /filter-rules
   * List all filter rules
   */
  const list: RequestHandler = async (_req, res, next) => {
    try {
      const rules = await storage.listFilterRules();
      res.json({ data: rules });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /filter-rules/:id
   * Get filter rule by ID
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const rule = await storage.getFilterRuleById(id);

      if (!rule) {
        throw notFound('Filter rule');
      }

      res.json({ data: rule });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /filter-rules/:id
   * Update filter rule
   */
  const update: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const input: UpdateFilterRuleRequest = UpdateFilterRuleSchema.parse(req.body);

      // Check if rule exists
      const existing = await storage.getFilterRuleById(id);
      if (!existing) {
        throw notFound('Filter rule');
      }

      const rule = await storage.updateFilterRule(id, {
        name: input.name,
        description: input.description,
        type: input.type,
        condition: input.condition,
        enabled: input.enabled,
      });

      res.json({ data: rule });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /filter-rules/:id
   * Delete filter rule
   */
  const remove: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      // Check if rule exists
      const existing = await storage.getFilterRuleById(id);
      if (!existing) {
        throw notFound('Filter rule');
      }

      await storage.deleteFilterRule(id);
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
