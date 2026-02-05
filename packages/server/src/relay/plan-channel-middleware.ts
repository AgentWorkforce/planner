/**
 * Plan Channel Middleware
 *
 * Express middleware that creates relay channels for newly created plans.
 * Intercepts POST /api/plans responses and calls createPlanChannel on success.
 */

import type { Request, Response, NextFunction } from 'express';
import { createPlanChannel } from './channels.js';
import { isConnected } from './client.js';
import { notifyNewPlan } from './planner-lead.js';

/**
 * Response body structure from POST /api/plans.
 */
interface CreatePlanResponse {
  plan: {
    plan_id: string;
  };
  version: {
    summary: {
      goal: string;
      context?: string;
    };
  };
}

/**
 * Middleware that intercepts POST /api/plans responses.
 * On successful plan creation (201), creates the relay channel.
 */
export function planChannelMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only intercept POST /plans (plan creation)
  if (req.method !== 'POST' || !req.path.match(/^\/plans\/?$/)) {
    next();
    return;
  }

  // Capture the original json method
  const originalJson = res.json.bind(res);

  // Override json to intercept the response
  res.json = function (body: unknown): Response {
    // Check if this is a successful plan creation (201)
    if (res.statusCode === 201 && body && typeof body === 'object') {
      const data = body as CreatePlanResponse;

      // Extract plan info
      const planId = data.plan?.plan_id;
      const goal = data.version?.summary?.goal;
      const context = data.version?.summary?.context;

      if (planId) {
        // Create channel asynchronously (don't block response)
        setImmediate(() => {
          try {
            if (!isConnected()) {
              console.log(`[plan-channel-middleware] Skipping channel creation: relay not connected`);
              return;
            }

            // Create the plan channel
            const channelId = createPlanChannel(planId, goal);

            if (channelId) {
              console.log(`[plan-channel-middleware] Created channel ${channelId} for plan ${planId}`);

              // Notify PlannerLead of the new plan
              notifyNewPlan(channelId, planId, goal || 'New plan', context).catch((err) => {
                console.error(`[plan-channel-middleware] Error notifying PlannerLead:`, err);
              });
            }
          } catch (error) {
            // Log but don't fail - channel creation is non-critical
            console.error(`[plan-channel-middleware] Error creating channel:`, error);
          }
        });
      }
    }

    // Call original json method
    return originalJson(body);
  };

  next();
}
