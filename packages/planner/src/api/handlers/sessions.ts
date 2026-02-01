/**
 * Session API Handlers
 *
 * Provides endpoints for querying and managing planning sessions.
 * In standalone mode, agent spawning is not available.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound, badRequest } from '../middleware.js';

interface PlanIdParams {
  id: string;
}

/**
 * Creates session route handlers with injected storage dependency.
 * Standalone version - no agent spawning.
 */
export function createSessionHandlers(storage: PlanStorage) {
  return {
    /**
     * GET /plans/:id/session
     * Get the active session for a plan.
     * Returns session info or { status: 'none' } if no active session.
     */
    getSession: (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        // Check if plan exists
        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Get active session for this plan
        const session = storage.getSessionByPlanId(id);

        if (!session) {
          res.json({ status: 'none' });
          return;
        }

        res.json({
          session_id: session.session_id,
          status: session.status,
          started_at: session.started_at,
          agent_id: session.agent_id,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * DELETE /plans/:id/session
     * Terminate the active session for a plan.
     * Returns { success: true, session_id } on success.
     * Returns 404 if no active session.
     */
    terminateSession: async (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        // Check if plan exists
        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Get active session for this plan
        const session = storage.getSessionByPlanId(id);

        if (!session) {
          throw notFound('Active session');
        }

        // Mark session as terminated
        storage.updateSessionStatus(session.session_id, 'terminated');
        console.log(`[sessions] Session ${session.session_id} terminated via API (standalone mode)`);

        res.json({
          success: true,
          session_id: session.session_id,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/session
     * Create a new session for an existing plan.
     * In standalone mode, returns 503 (AI service unavailable).
     */
    createSession: async (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        // Check if plan exists
        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Check if session already exists
        const existingSession = storage.getSessionByPlanId(id);
        if (existingSession) {
          res.status(409).json({
            error: 'Session already exists',
            session_id: existingSession.session_id,
            status: existingSession.status,
            agent_id: existingSession.agent_id,
            started_at: existingSession.started_at,
          });
          return;
        }

        // Get latest version to check status
        const latestVersion = storage.getLatestVersion(id);
        if (!latestVersion) {
          throw notFound('Plan version');
        }

        // Only draft plans can have AI sessions
        if (latestVersion.status !== 'draft') {
          throw badRequest('Only draft plans can have AI sessions');
        }

        // Standalone mode - relay/agent spawning not available
        res.status(503).json({
          error: 'AI service unavailable',
          message: 'Running in standalone mode - agent spawning requires relay integration',
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
