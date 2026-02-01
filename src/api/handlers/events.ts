/**
 * SSE Events Handler
 *
 * Provides Server-Sent Events endpoint for real-time plan change notifications.
 * UI clients subscribe when AI agent is connected to receive updates when
 * the agent modifies the plan via MCP tools.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { onPlanChange, offPlanChange, type PlanChangeEvent, type PlanChangeCallback } from '../../events/plan-events.js';
import { onQuestionEvent, offQuestionEvent, type QuestionEvent, type QuestionEventCallback } from '../../events/question-events.js';
import { notFound } from '../middleware.js';

interface PlanIdParams {
  id: string;
}

/** Keepalive interval in milliseconds (30 seconds) */
const KEEPALIVE_INTERVAL_MS = 30 * 1000;

/**
 * Creates SSE event handlers with injected storage dependency.
 */
export function createEventsHandler(storage: PlanStorage) {
  return {
    /**
     * GET /plans/:id/events
     * SSE endpoint for plan change events.
     * Streams events when the plan is modified (steps added/edited/removed).
     */
    planEvents: (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      const { id: planId } = req.params;

      // Verify plan exists
      const plan = storage.getPlan(planId);
      if (!plan) {
        return next(notFound('Plan'));
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial comment to establish connection
      res.write(':connected\n\n');

      // Create callback for plan changes
      const handleChange: PlanChangeCallback = (event: PlanChangeEvent) => {
        const data = JSON.stringify({
          version: event.version,
          changeType: event.changeType,
          stepId: event.stepId,
          role: event.role,
          domain: event.domain,
          timestamp: event.timestamp,
        });
        res.write(`event: plan_change\ndata: ${data}\n\n`);
      };

      // Subscribe to plan changes
      onPlanChange(planId, handleChange);

      // Create callback for question events
      const handleQuestion: QuestionEventCallback = (event: QuestionEvent) => {
        const data = JSON.stringify({
          questionId: event.questionId,
          eventType: event.eventType,
          question: event.question,
          timestamp: event.timestamp,
        });
        res.write(`event: question_event\ndata: ${data}\n\n`);
      };

      // Subscribe to question events
      onQuestionEvent(planId, handleQuestion);

      // Send keepalive comments to prevent connection timeout
      const keepaliveInterval = setInterval(() => {
        res.write(':keepalive\n\n');
      }, KEEPALIVE_INTERVAL_MS);

      // Cleanup on client disconnect
      req.on('close', () => {
        clearInterval(keepaliveInterval);
        offPlanChange(planId, handleChange);
        offQuestionEvent(planId, handleQuestion);
      });

      // Don't call next() - we're handling the response
    },
  };
}
