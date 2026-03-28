import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import type { DecisionEvent } from '../../domain/trajectory.js';
import { createTrajectoryService } from '../../trajectory/service.js';
import { notFound, badRequest } from '../middleware.js';

interface PlanParams {
  id: string;
}

interface RecordDecisionBody {
  question_id: string;
  asking_agent: string;
  question_text: string;
  context_provided?: string;
  options_presented: string[];
  selected_option: string | null;
  free_text_response?: string;
  reasoning?: string;
  step_id?: string;
  agent_trajectory_ref?: string;
}

interface TrajectoryEventFilterQuery {
  agent_id?: string;
  event_type?: 'decision';
  from_date?: string;
  to_date?: string;
  step_id?: string;
}

interface FindSimilarQuery {
  text: string;
  threshold?: string;
}

/**
 * Creates trajectory route handlers with injected storage dependency.
 */
export function createTrajectoryHandlers(storage: PlanStorage) {
  const trajectoryService = createTrajectoryService(storage);

  return {
    /**
     * GET /plans/:id/trajectory/events
     * List trajectory events for a plan with optional filters.
     */
    listEvents: (
      req: Request<PlanParams, unknown, unknown, TrajectoryEventFilterQuery>,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { id } = req.params;

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const filter = {
          agent_id: req.query.agent_id,
          event_type: req.query.event_type,
          from_date: req.query.from_date,
          to_date: req.query.to_date,
          step_id: req.query.step_id,
        };

        const events = trajectoryService.queryEvents(id, filter);
        res.json({ events, total: events.length });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/trajectory/decision
     * Record a decision event.
     */
    recordDecision: (
      req: Request<PlanParams, unknown, RecordDecisionBody>,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { id } = req.params;
        const body = req.body;

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Validate required fields
        if (
          !body.question_id ||
          !body.asking_agent ||
          !body.question_text ||
          !body.options_presented
        ) {
          throw badRequest(
            'Missing required fields: question_id, asking_agent, question_text, options_presented'
          );
        }

        const event = trajectoryService.recordDecision({
          plan_id: id,
          question_id: body.question_id,
          asking_agent: body.asking_agent,
          question_text: body.question_text,
          context_provided: body.context_provided,
          options_presented: body.options_presented,
          selected_option: body.selected_option,
          free_text_response: body.free_text_response,
          reasoning: body.reasoning,
          step_id: body.step_id,
          agent_trajectory_ref: body.agent_trajectory_ref,
        });

        res.status(201).json({ event });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/trajectory/preferences
     * Get derived preferences from trajectory analysis.
     */
    getPreferences: (req: Request<PlanParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const preferences = trajectoryService.getPreferences(id);
        res.json({ preferences, total: preferences.length });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/trajectory/similar?text=...&threshold=0.7
     * Find similar past questions.
     */
    findSimilar: (
      req: Request<PlanParams, unknown, unknown, FindSimilarQuery>,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { id } = req.params;
        const { text, threshold } = req.query;

        if (!text) {
          throw badRequest('Missing required query parameter: text');
        }

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const thresholdNum = threshold ? parseFloat(threshold) : 0.7;
        const similar = trajectoryService.findSimilarQuestions(id, text, thresholdNum);

        res.json({ similar, total: similar.length });
      } catch (err) {
        next(err);
      }
    },
  };
}
