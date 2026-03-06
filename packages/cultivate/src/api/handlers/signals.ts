/**
 * Signal API handlers
 * Handles Signal CRUD operations and user actions (link/dismiss)
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import type { TunerClient } from '../../tuner/client.js';
import {
  ListSignalsQuerySchema,
  LinkSignalSchema,
  DismissSignalSchema,
} from '../schemas.js';

/**
 * Create Signal handler factory
 *
 * @param storage - Cultivate storage instance
 * @param tunerClient - Optional TunerClient for outcome recording
 * @returns Object with Signal handler functions
 */
export function createSignalHandlers(
  storage: CultivateStorage,
  tunerClient?: TunerClient
) {
  /**
   * List signals with filters and pagination
   * GET /signals?greenhouse_id=...&status=...&cluster_id=...&limit=20&offset=0
   */
  const list: RequestHandler = async (req, res, next) => {
    try {
      // Parse and validate query parameters
      const query = ListSignalsQuerySchema.parse(req.query);

      // Build filters for storage query
      const filters = {
        greenhouse_id: query.greenhouse_id,
        status: query.status,
        cluster_id: query.cluster_id,
        intent: query.intent,
        limit: query.limit,
        offset: query.offset,
      };

      // Fetch signals from storage
      const signals = await storage.listSignals(filters);

      res.json({ data: signals });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get a single signal by ID
   * GET /signals/:id
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const signal = await storage.getSignalById(id);

      if (!signal) {
        throw notFound('Signal');
      }

      // Load extraction data for this signal
      const extraction = await storage.getExtractionBySignalId(id);

      res.json({ data: { ...signal, extraction } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Link a signal to a plan
   * POST /signals/:id/link
   * Body: { plan_id: string }
   *
   * Sets signal status to 'clustered' (assuming signals are linked after clustering)
   * and records a tuner outcome for adaptive learning.
   */
  const link: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const body = LinkSignalSchema.parse(req.body);

      const signal = await storage.getSignalById(id);
      if (!signal) {
        throw notFound('Signal');
      }

      // Update signal with linked plan ID and status
      const updatedSignal = await storage.updateSignal(id, {
        linked_plan_id: body.plan_id,
        status: 'clustered',
      });

      // Record tuner outcome (non-blocking)
      if (tunerClient) {
        try {
          await tunerClient.recordOutcome({
            signal_id: id,
            action: 'link',
            greenhouse_id: signal.greenhouse_id,
            cluster_id: signal.cluster_id,
            metadata: {
              plan_id: body.plan_id,
              score: signal.score,
            },
          });
        } catch (tunerErr) {
          // Log error but don't fail the request
          console.warn(
            `[signals] Failed to record tuner outcome for signal ${id}:`,
            tunerErr
          );
        }
      }

      res.json({ data: updatedSignal });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Dismiss a signal
   * POST /signals/:id/dismiss
   * Body: { reason?: string }
   *
   * Sets signal status to 'decayed' (dismissed by user)
   * and records a tuner outcome for adaptive learning.
   */
  const dismiss: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const body = DismissSignalSchema.parse(req.body);

      const signal = await storage.getSignalById(id);
      if (!signal) {
        throw notFound('Signal');
      }

      // Update signal status to decayed (dismissed)
      const updatedSignal = await storage.updateSignal(id, {
        status: 'decayed',
      });

      // Record tuner outcome (non-blocking)
      if (tunerClient) {
        try {
          await tunerClient.recordOutcome({
            signal_id: id,
            action: 'dismiss',
            greenhouse_id: signal.greenhouse_id,
            cluster_id: signal.cluster_id,
            metadata: {
              reason: body.reason,
              score: signal.score,
            },
          });
        } catch (tunerErr) {
          // Log error but don't fail the request
          console.warn(
            `[signals] Failed to record tuner outcome for signal ${id}:`,
            tunerErr
          );
        }
      }

      res.json({ data: updatedSignal });
    } catch (err) {
      next(err);
    }
  };

  return {
    list,
    get,
    link,
    dismiss,
  };
}
