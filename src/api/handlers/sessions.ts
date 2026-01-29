/**
 * Session API Handlers
 *
 * Provides endpoints for querying and managing planning sessions.
 * GET /plans/:id/session - Get active session status
 * POST /plans/:id/session - Create a new session for an existing plan
 * DELETE /plans/:id/session - Terminate active session
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage, Session } from '../../storage/interface.js';
import { notFound, badRequest } from '../middleware.js';
import { terminateAgent, spawnPlanningAgent } from '../../relay/spawner.js';
import { isRelayAvailable } from '../../relay/service.js';
import { randomUUID } from 'crypto';

interface PlanIdParams {
  id: string;
}

/**
 * Creates session route handlers with injected storage dependency.
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
        console.log(`[sessions] Session ${session.session_id} terminated via API`);

        // Terminate the agent process
        try {
          await terminateAgent(session.agent_id);
          console.log(`[sessions] Terminated agent ${session.agent_id} via API`);
        } catch (err) {
          // Log but don't fail if agent termination fails
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[sessions] Failed to terminate agent ${session.agent_id}: ${message}`);
        }

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
     * Create a new session for an existing plan, spawning an AI planning agent.
     * Returns { session_id, status: 'active', agent_id, started_at } on success.
     * Returns 404 if plan doesn't exist.
     * Returns 409 if session already exists (includes existing session info).
     * Returns 400 if plan is not in draft status.
     * Returns 503 if relay is unavailable.
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

        // Get latest version to check status and get goal/steps
        const latestVersion = storage.getLatestVersion(id);
        if (!latestVersion) {
          throw notFound('Plan version');
        }

        // Only draft plans can have AI sessions
        if (latestVersion.status !== 'draft') {
          throw badRequest('Only draft plans can have AI sessions');
        }

        // Check relay availability
        if (!isRelayAvailable()) {
          res.status(503).json({
            error: 'AI service unavailable',
          });
          return;
        }

        // Spawn the agent
        const goal = latestVersion.summary?.goal || `Plan ${id}`;
        const existingStepCount = latestVersion.steps?.length || 0;

        const spawnResult = await spawnPlanningAgent({
          planId: id,
          goal,
          existingStepCount,
        });

        // Create session record
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

        const sessionRecord: Session = {
          session_id: randomUUID(),
          token: spawnResult.sessionToken,
          plan_id: id,
          agent_id: spawnResult.agentId,
          status: 'active',
          started_at: now,
          ended_at: null,
          expires_at: expiresAt,
          created_at: now,
        };

        storage.createSession(sessionRecord);
        console.log(`[sessions] Created session ${sessionRecord.session_id} for plan ${id}`);

        res.json({
          session_id: sessionRecord.session_id,
          status: 'active',
          agent_id: spawnResult.agentId,
          started_at: now,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
