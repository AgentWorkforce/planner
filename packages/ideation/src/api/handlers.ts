/**
 * Ideation API - Request Handlers
 *
 * Express request handlers for ideation endpoints.
 */

import type { Request, Response } from 'express';
import type { IdeationStorage } from '../storage/index.js';
import {
  createTranscriptMessage,
  computeAggregateConfidence,
  getConfidenceLevel,
  createPlannerSend,
  type SessionSource,
  type PlannerSendPayload,
} from '../domain/index.js';
import {
  CreateSessionRequestSchema,
  ListSessionsQuerySchema,
  AddMessageRequestSchema,
  UpdateUnderstandingRequestSchema,
  SendToPlannerRequestSchema,
} from './schemas.js';
import { ideationEvents } from './events.js';

// =============================================================================
// Planner Client Interface
// =============================================================================

export interface PlannerClient {
  createPlan(params: {
    goal: string;
    context?: string;
    source?: { type: 'ideation'; session_id: string };
    understanding?: Record<string, Record<string, unknown>>;
    initiative_id?: string;
  }): Promise<{ plan_id: string; version: number }>;
}

export interface HandlerConfig {
  storage: IdeationStorage;
  plannerClient?: PlannerClient;
}

// =============================================================================
// Handler Factory
// =============================================================================

export function createHandlers(config: IdeationStorage | HandlerConfig) {
  // Support both old (storage only) and new (config object) signatures
  const storage: IdeationStorage = 'storage' in config ? config.storage : config;
  const plannerClient: PlannerClient | undefined = 'storage' in config ? config.plannerClient : undefined;
  // ===========================================================================
  // Session CRUD (#112)
  // ===========================================================================

  async function createSession(req: Request, res: Response): Promise<void> {
    try {
      const parsed = CreateSessionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const { initial_intent, initiative_id } = parsed.data;
      const source: SessionSource = { type: 'human', initial_intent };
      const session = await storage.createSession(source, initiative_id);

      ideationEvents.emitSessionEvent('session:created', session);
      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  async function getSession(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const session = await storage.getSession(id);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json(session);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  async function listSessions(req: Request, res: Response): Promise<void> {
    try {
      const parsed = ListSessionsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
        return;
      }

      const sessions = await storage.listSessions(parsed.data);
      res.json(sessions);
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  }

  async function abandonSession(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const session = await storage.updateSessionStatus(id, 'abandoned');

      ideationEvents.emitSessionEvent('session:updated', session);
      res.json(session);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      console.error('Error abandoning session:', error);
      res.status(500).json({ error: 'Failed to abandon session' });
    }
  }

  // ===========================================================================
  // Message and Understanding (#113)
  // ===========================================================================

  async function addMessage(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const parsed = AddMessageRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const { role, content } = parsed.data;
      const message = createTranscriptMessage(role, content);
      const session = await storage.appendTranscript(id, message);

      ideationEvents.emitSessionEvent('session:message', session);
      res.json(session);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      console.error('Error adding message:', error);
      res.status(500).json({ error: 'Failed to add message' });
    }
  }

  async function updateUnderstanding(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const parsed = UpdateUnderstandingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const { specialist_name, observations } = parsed.data;
      const session = await storage.updateUnderstanding(id, specialist_name, observations);

      ideationEvents.emitSessionEvent('session:understanding', session);
      res.json(session);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      console.error('Error updating understanding:', error);
      res.status(500).json({ error: 'Failed to update understanding' });
    }
  }

  // ===========================================================================
  // Send to Planner (#114)
  // ===========================================================================

  async function sendToPlanner(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const parsed = SendToPlannerRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const existingSession = await storage.getSession(id);
      if (!existingSession) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Build payload
      const payload: PlannerSendPayload = {
        goal: parsed.data.goal ?? existingSession.source.initial_intent,
        context: parsed.data.context,
        source: { type: 'ideation', session_id: existingSession.id },
        understanding: existingSession.understanding,
        initiative_id: parsed.data.initiative_id ?? existingSession.initiative_id,
      };

      // Call planner API if client available, otherwise mock
      let result: { plan_id: string; plan_version: number };

      if (plannerClient) {
        const plannerResult = await plannerClient.createPlan({
          goal: payload.goal,
          context: payload.context,
          source: payload.source,
          understanding: payload.understanding,
          initiative_id: payload.initiative_id,
        });
        result = {
          plan_id: plannerResult.plan_id,
          plan_version: plannerResult.version,
        };
      } else {
        // Mock result when no planner client configured
        result = {
          plan_id: `plan-${Date.now()}`,
          plan_version: 1,
        };
      }

      const send = createPlannerSend(payload, result);
      const session = await storage.appendPlannerSend(existingSession.id, send);

      ideationEvents.emitSessionEvent('session:planner_send', session);

      res.json({
        plan_id: result.plan_id,
        plan_version: result.plan_version,
        sent_at: send.sent_at,
      });
    } catch (error) {
      console.error('Error sending to planner:', error);
      res.status(500).json({ error: 'Failed to send to planner' });
    }
  }

  // ===========================================================================
  // Confidence (#115)
  // ===========================================================================

  async function getConfidence(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const session = await storage.getSession(id);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const { score, breakdown } = computeAggregateConfidence(session.understanding);
      const level = getConfidenceLevel(score);

      res.json({ score, level, breakdown });
    } catch (error) {
      console.error('Error getting confidence:', error);
      res.status(500).json({ error: 'Failed to get confidence' });
    }
  }

  // ===========================================================================
  // SSE Events (#116)
  // ===========================================================================

  function subscribeToEvents(req: Request, res: Response): void {
    const id = req.params.id ? String(req.params.id) : undefined;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial ping
    res.write('event: ping\ndata: connected\n\n');

    // Subscribe to session events
    const handler = (event: { session_id: string; type: string; data: unknown }) => {
      // If id is specified, only send events for that session
      if (id && event.session_id !== id) return;

      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    ideationEvents.on('session', handler);

    // Cleanup on close
    req.on('close', () => {
      ideationEvents.off('session', handler);
    });
  }

  return {
    createSession,
    getSession,
    listSessions,
    abandonSession,
    addMessage,
    updateUnderstanding,
    sendToPlanner,
    getConfidence,
    subscribeToEvents,
  };
}
