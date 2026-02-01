/**
 * Ideation API - Routes
 *
 * Express router setup for ideation endpoints.
 */

import { Router } from 'express';
import type { IdeationStorage } from '../storage/index.js';
import { createHandlers } from './handlers.js';

export function createIdeationRouter(storage: IdeationStorage): Router {
  const router = Router();
  const handlers = createHandlers(storage);

  // ===========================================================================
  // Session Routes
  // ===========================================================================

  /**
   * POST /sessions - Create new ideation session
   * Body: { initial_intent: string, initiative_id?: string }
   */
  router.post('/sessions', handlers.createSession);

  /**
   * GET /sessions - List all sessions
   * Query: { status?: 'active' | 'abandoned', initiative_id?: string }
   */
  router.get('/sessions', handlers.listSessions);

  /**
   * GET /sessions/:id - Get session by ID
   */
  router.get('/sessions/:id', handlers.getSession);

  /**
   * POST /sessions/:id/abandon - Abandon a session
   */
  router.post('/sessions/:id/abandon', handlers.abandonSession);

  // ===========================================================================
  // Message Routes
  // ===========================================================================

  /**
   * POST /sessions/:id/messages - Add message to transcript
   * Body: { role: 'user' | 'assistant', content: string }
   */
  router.post('/sessions/:id/messages', handlers.addMessage);

  // ===========================================================================
  // Understanding Routes
  // ===========================================================================

  /**
   * PUT /sessions/:id/understanding - Update specialist observations
   * Body: { specialist_name: string, observations: Record<string, unknown> }
   */
  router.put('/sessions/:id/understanding', handlers.updateUnderstanding);

  // ===========================================================================
  // Planner Routes
  // ===========================================================================

  /**
   * POST /sessions/:id/send-to-planner - Send understanding to planner
   * Body: { goal?: string, context?: string, initiative_id?: string }
   */
  router.post('/sessions/:id/send-to-planner', handlers.sendToPlanner);

  // ===========================================================================
  // Confidence Routes
  // ===========================================================================

  /**
   * GET /sessions/:id/confidence - Get aggregate confidence score
   * Response: { score: number, level: 'low'|'medium'|'high', breakdown: Record<string, string> }
   */
  router.get('/sessions/:id/confidence', handlers.getConfidence);

  // ===========================================================================
  // SSE Routes
  // ===========================================================================

  /**
   * GET /sessions/:id/events - Subscribe to session events via SSE
   * GET /events - Subscribe to all session events via SSE
   */
  router.get('/sessions/:id/events', handlers.subscribeToEvents);
  router.get('/events', handlers.subscribeToEvents);

  return router;
}
