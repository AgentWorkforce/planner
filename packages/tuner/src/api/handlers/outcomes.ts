/**
 * Outcome API Handlers
 *
 * Endpoints for Forge to submit execution outcomes.
 */

import type { Request, Response } from 'express';
import { TaskOutcomeSchema, RunOutcomeSchema } from '../../domain/outcome.js';
import type { TunerServices } from '../../services/factory.js';

/**
 * Create outcome API handlers.
 */
export function createOutcomeHandlers(services: TunerServices) {
  return {
    /**
     * POST /api/tuner/outcomes/task
     * Accepts TaskOutcome from Forge.
     */
    recordTaskOutcome: (req: Request, res: Response) => {
      try {
        // Validate request body
        const parseResult = TaskOutcomeSchema.safeParse(req.body);

        if (!parseResult.success) {
          res.status(400).json({
            error: 'Invalid task outcome',
            details: parseResult.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          });
          return;
        }

        // Record outcome (fire-and-forget processing)
        const result = services.collector.recordTaskOutcome(parseResult.data);

        res.json({
          received: result.received,
          id: parseResult.data.task_id,
        });
      } catch (error) {
        console.error('[Tuner API] Error recording task outcome:', error);
        res.status(500).json({ error: 'Failed to record task outcome' });
      }
    },

    /**
     * POST /api/tuner/outcomes/run
     * Accepts RunOutcome from Forge.
     */
    recordRunOutcome: (req: Request, res: Response) => {
      try {
        // Validate request body
        const parseResult = RunOutcomeSchema.safeParse(req.body);

        if (!parseResult.success) {
          res.status(400).json({
            error: 'Invalid run outcome',
            details: parseResult.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          });
          return;
        }

        // Record outcome
        const result = services.collector.recordRunOutcome(parseResult.data);

        res.json({
          received: result.received,
          id: parseResult.data.run_id,
        });
      } catch (error) {
        console.error('[Tuner API] Error recording run outcome:', error);
        res.status(500).json({ error: 'Failed to record run outcome' });
      }
    },

    /**
     * GET /api/tuner/outcomes?run_id=xxx
     * Query task outcomes for a given run_id (for testbench).
     */
    getOutcomesByRun: (req: Request, res: Response) => {
      try {
        const runId = req.query.run_id as string;

        if (!runId) {
          res.status(400).json({ error: 'run_id query parameter is required' });
          return;
        }

        const outcomes = services.storage.getTaskOutcomesByRunId(runId);

        const mappedOutcomes = outcomes.map((outcome) => ({
          task_id: outcome.task_id,
          run_id: outcome.run_id,
          success: outcome.outcome === 'success',
          tokens_used: outcome.tokens_used,
          cost_usd: outcome.cost_usd,
          duration_seconds: outcome.duration_seconds,
          model_id: outcome.model_used,
        }));

        res.json({ outcomes: mappedOutcomes });
      } catch (error) {
        console.error('[Tuner API] Error fetching outcomes by run:', error);
        res.status(500).json({ error: 'Failed to fetch outcomes' });
      }
    },
  };
}
