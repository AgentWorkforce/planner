/**
 * Plan Channel Middleware
 *
 * Express middleware that creates relay channels for newly created plans.
 * Intercepts POST /api/plans responses and calls createPlanChannel on success.
 */

import type { Request, Response, NextFunction } from 'express';
import { createPlanChannel, getPlanChannelId, channelExists } from './channels.js';
import { isConnected } from './client.js';

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
    steps?: Array<unknown>;
  };
}

/**
 * Response body structure from POST /api/plans/:id/versions.
 */
interface VersionCreationResponse {
  version: {
    summary: {
      goal: string;
      context?: string;
    };
    steps?: Array<unknown>;
  };
}

/**
 * Middleware that intercepts POST /api/plans and POST /api/plans/:id/versions responses.
 * On successful plan/version creation (201), creates/ensures the relay channel and notifies PlannerLead.
 */
export function planChannelMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST') {
    next();
    return;
  }

  const isPlanCreation = req.path.match(/^\/plans\/?$/);
  const isVersionCreation = req.path.match(/^\/plans\/([^/]+)\/versions\/?$/);

  if (!isPlanCreation && !isVersionCreation) {
    next();
    return;
  }

  // Capture the original json method
  const originalJson = res.json.bind(res);

  // Override json to intercept the response
  res.json = function (body: unknown): Response {
    // Check if this is a successful creation (201)
    if (res.statusCode === 201 && body && typeof body === 'object') {
      // Handle plan creation
      if (isPlanCreation) {
        const data = body as CreatePlanResponse;
        const planId = data.plan?.plan_id;
        const goal = data.version?.summary?.goal;
        const context = data.version?.summary?.context;
        const stepCount = data.version?.steps?.length ?? 0;

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
                // Note: Spawned PlannerLead agent will be notified via lifecycle manager
              }
            } catch (error) {
              // Log but don't fail - channel creation is non-critical
              console.error(`[plan-channel-middleware] Error creating channel:`, error);
            }
          });
        }
      }
      // Handle version creation
      else if (isVersionCreation) {
        const planId = isVersionCreation[1];
        const data = body as VersionCreationResponse;
        const goal = data.version?.summary?.goal;
        const context = data.version?.summary?.context;
        const stepCount = data.version?.steps?.length ?? 0;

        if (planId) {
          // Ensure channel exists and notify asynchronously
          setImmediate(() => {
            try {
              if (!isConnected()) {
                console.log(`[plan-channel-middleware] Skipping notification: relay not connected`);
                return;
              }

              const channelId = getPlanChannelId(planId);

              // Create channel if it doesn't exist yet
              if (!channelExists(channelId)) {
                console.log(`[plan-channel-middleware] Creating missing channel ${channelId} for plan ${planId}`);
                createPlanChannel(planId, goal);
              }
              // Note: Spawned PlannerLead agent will be notified via lifecycle manager
            } catch (error) {
              // Log but don't fail - channel operations are non-critical
              console.error(`[plan-channel-middleware] Error in version creation handler:`, error);
            }
          });
        }
      }
    }

    // Call original json method
    return originalJson(body);
  };

  next();
}
