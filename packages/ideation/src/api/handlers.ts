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
  createBlock,
  type SessionSource,
  type PlannerSendPayload,
  type Block,
  type Session,
} from '../domain/index.js';
import {
  CreateSessionRequestSchema,
  ListSessionsQuerySchema,
  AddMessageRequestSchema,
  UpdateUnderstandingRequestSchema,
  SendToPlannerRequestSchema,
  CreateBlockRequestSchema,
  UpdateBlockRequestSchema,
  UpdateSessionRequestSchema,
} from './schemas.js';
import { ideationEvents } from './events.js';
import { sessionChannelId } from '../interviewer/config.js';
import { interviewer } from '../interviewer/service.js';
import { specialistQueue } from '../interviewer/specialist-queue.js';
import { conversationHistory } from '../interviewer/history.js';
import { sendChannelMessage, isConnected as isRelayConnected } from '../relay/index.js';
import { navigatorService, isNavigatorActive } from '../navigator/index.js';

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

  createVersion(params: {
    plan_id: string;
    goal: string;
    context?: string;
    understanding?: Record<string, Record<string, unknown>>;
  }): Promise<{ plan_id: string; version: number }>;

  updatePlan(params: {
    plan_id: string;
    understanding?: Record<string, Record<string, unknown>>;
  }): Promise<void>;
}

export interface HandlerConfig {
  storage: IdeationStorage;
  plannerClient?: PlannerClient;
}

// =============================================================================
// SSE Configuration
// =============================================================================

/** SSE keep-alive interval in milliseconds (30 seconds) */
const SSE_KEEPALIVE_INTERVAL_MS = 30_000;

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

      // Clean up in-memory state to prevent memory leaks
      const channelId = sessionChannelId(id);
      const sessionPrefix = id.slice(0, 8);
      conversationHistory.clearHistory(channelId);
      specialistQueue.clearQueue(sessionPrefix);
      console.log(`[ideation-handlers] Cleaned up memory for abandoned session ${id}`);

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

  async function updateSession(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const parsed = UpdateSessionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const session = await storage.updateSession(id, parsed.data);

      ideationEvents.emitSessionEvent('session:updated', session);
      res.json(session);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
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

      // For user messages, directly invoke Interviewer to get response
      // Note: We don't broadcast to relay here to avoid message loops.
      // The Interviewer is invoked directly, and external subscribers can listen via SSE.
      // IMPORTANT: The API handler stores messages (user above, assistant below).
      // The Interviewer should NOT use add_message tool when called from API context.
      if (role === 'user') {
        const channelId = sessionChannelId(id);
        console.log(`[ideation-handlers] Processing user message for ${channelId}`);

        // Directly invoke Interviewer - pass skipMessageStorage flag via fromAgent
        try {
          const response = await interviewer.handleMessage(channelId, content, 'api-handler');

          if (response) {
            // Store assistant response - this is the ONLY place assistant messages should be stored
            // for API-driven flow
            const assistantMessage = createTranscriptMessage('assistant', response);
            const updatedSession = await storage.appendTranscript(id, assistantMessage);

            // Emit event so SSE clients get notified
            ideationEvents.emitSessionEvent('session:message', updatedSession);
            console.log(`[ideation-handlers] Interviewer response stored and emitted`);

            // Return updated session with response
            res.json(updatedSession);
            return;
          }
        } catch (err) {
          console.error('[ideation-handlers] Error getting Interviewer response:', err);
          // Continue to return original session even if Interviewer fails
        }
      }

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
      const specialist = String(req.params.specialist ?? '');

      if (!specialist) {
        res.status(400).json({ error: 'Specialist name is required in URL' });
        return;
      }

      const parsed = UpdateUnderstandingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const { observations } = parsed.data;
      const session = await storage.updateUnderstanding(id, specialist, observations);

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

      // Get curated blocks to include in handoff
      const curatedBlocks = existingSession.blocks.filter(b => b.status === 'curated');

      // Build payload with understanding AND curated blocks
      // Blocks are included in understanding under '_blocks' key for planner AI to use
      const payload: PlannerSendPayload = {
        goal: parsed.data.goal ?? existingSession.source.initial_intent,
        context: parsed.data.context,
        source: { type: 'ideation', session_id: existingSession.id },
        understanding: {
          ...existingSession.understanding,
          // Include curated blocks as structured data for planner
          _blocks: {
            observations: curatedBlocks.map(b => b.content),
            keywords: curatedBlocks.map(b => b.keyword),
            // Store full blocks for reference
            blocks: curatedBlocks,
          },
        },
        initiative_id: parsed.data.initiative_id ?? existingSession.initiative_id,
      };

      // Call planner API if client available, otherwise mock
      let result: { plan_id: string; plan_version: number };

      // Check if this is a subsequent send
      const isSubsequentSend = existingSession.planner_sends.length > 0;

      if (plannerClient) {
        if (isSubsequentSend) {
          // Get the plan_id from the first send
          const firstSend = existingSession.planner_sends[0]!;
          const planId = firstSend.result?.plan_id;

          if (!planId) {
            res.status(500).json({ error: 'Cannot create version: previous send has no plan_id' });
            return;
          }

          // Create new version on existing plan and update understanding
          const plannerResult = await plannerClient.createVersion({
            plan_id: planId,
            goal: payload.goal,
            context: payload.context,
            understanding: payload.understanding,
          });

          // Update plan-level understanding
          await plannerClient.updatePlan({
            plan_id: planId,
            understanding: payload.understanding,
          });

          result = {
            plan_id: plannerResult.plan_id,
            plan_version: plannerResult.version,
          };
        } else {
          // First send - create new plan
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
        }
      } else {
        // No planner client configured - fail loudly
        res.status(503).json({
          error: 'Planner service unavailable',
          message: 'No planner client configured. Cannot send to planner.',
        });
        return;
      }

      const send = createPlannerSend(payload, result);
      // appendPlannerSend updates both planner_sends[] AND handoff tracking fields
      const session = await storage.appendPlannerSend(existingSession.id, send);

      ideationEvents.emitSessionEvent('session:planner_send', session);

      // Notify PlannerLead via plan channel
      const planChannelId = `#plan-${result.plan_id.slice(0, 8)}`;
      const notification = JSON.stringify({
        type: 'plan_from_ideation',
        plan_id: result.plan_id,
        session_id: existingSession.id,
        is_update: isSubsequentSend,
        goal: payload.goal,
      });

      if (isRelayConnected()) {
        const sent = sendChannelMessage(planChannelId, notification);
        if (sent) {
          console.log(`[ideation-handlers] Notified PlannerLead in ${planChannelId}`);
        } else {
          console.warn(`[ideation-handlers] Failed to notify PlannerLead in ${planChannelId}`);
        }
      } else {
        console.log(`[ideation-handlers] Relay not connected, skipping PlannerLead notification`);
      }

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
  // Block CRUD (#cv2-013)
  // ===========================================================================

  async function listBlocks(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const session = await storage.getSession(id);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json(session.blocks);
    } catch (error) {
      console.error('Error listing blocks:', error);
      res.status(500).json({ error: 'Failed to list blocks' });
    }
  }

  async function createBlockHandler(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const parsed = CreateBlockRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const session = await storage.getSession(id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const blockData = {
        type: parsed.data.type,
        title: parsed.data.title,
        keyword: parsed.data.keyword,
        emoji: parsed.data.emoji,
        content: parsed.data.content,
        specialist: parsed.data.specialist || 'user',
        sourceContext: parsed.data.sourceContext || 'user-created',
      };

      const block = createBlock(blockData);

      // Override confidence if provided
      if (parsed.data.confidence !== undefined) {
        block.confidence = parsed.data.confidence;
      }

      const updatedBlocks = [...session.blocks, block];
      await storage.updateBlocks(id, updatedBlocks);

      // Emit event for real-time updates
      const updatedSession = await storage.getSession(id);
      if (updatedSession) {
        ideationEvents.emitSessionEvent('session:block_created', updatedSession);
      }

      res.status(201).json(block);
    } catch (error) {
      console.error('Error creating block:', error);
      res.status(500).json({ error: 'Failed to create block' });
    }
  }

  async function updateBlock(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const blockId = String(req.params.blockId ?? '');
      const parsed = UpdateBlockRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
        return;
      }

      const session = await storage.getSession(id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const blockIndex = session.blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) {
        res.status(404).json({ error: 'Block not found' });
        return;
      }

      const updatedBlock = {
        ...session.blocks[blockIndex]!,
        ...parsed.data,
      };

      const updatedBlocks = [...session.blocks];
      updatedBlocks[blockIndex] = updatedBlock;
      await storage.updateBlocks(id, updatedBlocks);

      // Emit event for real-time updates
      const updatedSession = await storage.getSession(id);
      if (updatedSession) {
        ideationEvents.emitSessionEvent('session:block_updated', updatedSession);
      }

      res.json(updatedBlock);
    } catch (error) {
      console.error('Error updating block:', error);
      res.status(500).json({ error: 'Failed to update block' });
    }
  }

  async function deleteBlock(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const blockId = String(req.params.blockId ?? '');

      const session = await storage.getSession(id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const blockExists = session.blocks.some((b) => b.id === blockId);
      if (!blockExists) {
        res.status(404).json({ error: 'Block not found' });
        return;
      }

      const updatedBlocks = session.blocks.filter((b) => b.id !== blockId);
      await storage.updateBlocks(id, updatedBlocks);

      // Emit event for real-time updates
      const updatedSession = await storage.getSession(id);
      if (updatedSession) {
        ideationEvents.emitSessionEvent('session:block_deleted', updatedSession);
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting block:', error);
      res.status(500).json({ error: 'Failed to delete block' });
    }
  }

  async function curateBlock(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      const blockId = String(req.params.blockId ?? '');

      const session = await storage.getSession(id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const blockIndex = session.blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) {
        res.status(404).json({ error: 'Block not found' });
        return;
      }

      const updatedBlock: Block = {
        ...session.blocks[blockIndex]!,
        status: 'curated',
        curatedAt: new Date().toISOString(),
      };

      const updatedBlocks = [...session.blocks];
      updatedBlocks[blockIndex] = updatedBlock;
      await storage.updateBlocks(id, updatedBlocks);

      // Emit event for real-time updates
      const updatedSession = await storage.getSession(id);
      if (updatedSession) {
        ideationEvents.emitSessionEvent('session:block_curated', updatedSession);
      }

      res.json(updatedBlock);
    } catch (error) {
      console.error('Error curating block:', error);
      res.status(500).json({ error: 'Failed to curate block' });
    }
  }

  // ===========================================================================
  // SSE Events (#116)
  // ===========================================================================

  function subscribeToEvents(req: Request, res: Response): void {
    const id = req.params.id ? String(req.params.id) : undefined;

    // Set up SSE headers - include all anti-buffering headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders();

    // Send initial ping (unnamed event so onmessage receives it)
    res.write('data: {"type":"ping","status":"connected"}\n\n');

    // Subscribe to session events
    // Map backend event types to frontend expected format
    console.log(`[ideation-sse] Client connected for session: ${id || 'all'}`);

    const handler = (event: { session_id: string; type: string; data: Session }) => {
      console.log(`[ideation-sse] Received event: type=${event.type}, session_id=${event.session_id}, filtering for=${id || 'all'}`);

      // If id is specified, only send events for that session
      if (id && event.session_id !== id) {
        console.log(`[ideation-sse] Skipping event: session mismatch`);
        return;
      }

      // Convert to format frontend expects
      let frontendEvent: { type: string; [key: string]: unknown } | null = null;

      switch (event.type) {
        case 'session:message':
          console.log(`[ideation-sse] Converting session:message, transcript length: ${(event.data.transcript as unknown[])?.length || 0}`);
          frontendEvent = { type: 'transcript_updated', transcript: event.data.transcript };
          break;
        case 'session:understanding': {
          frontendEvent = { type: 'understanding_updated', understanding: event.data.understanding };
          // Also emit confidence_changed when understanding updates
          const understanding = event.data.understanding as Record<string, Record<string, unknown>> | undefined;
          if (understanding) {
            const { score, breakdown } = computeAggregateConfidence(understanding);
            const confidenceEvent = JSON.stringify({ type: 'confidence_changed', score, breakdown });
            res.write(`data: ${confidenceEvent}\n\n`);
          }
          break;
        }
        case 'session:updated':
          frontendEvent = { type: 'status_changed', status: event.data.status };
          break;
        case 'session:block_created':
        case 'session:block_updated':
        case 'session:block_deleted':
        case 'session:block_curated':
          // For block events, send all blocks (frontend will reconcile)
          frontendEvent = { type: event.type, blocks: event.data.blocks };
          break;
        default:
          // For other events, send the full data
          frontendEvent = { type: event.type, ...event.data };
      }

      if (frontendEvent) {
        const jsonData = JSON.stringify(frontendEvent);
        console.log(`[ideation-sse] Writing SSE data: ${jsonData.substring(0, 100)}...`);
        res.write(`data: ${jsonData}\n\n`);
      }
    };

    ideationEvents.on('session', handler);
    console.log(`[ideation-sse] Subscribed to session events`);

    // Keep-alive ping to prevent connection timeout
    const keepAliveInterval = setInterval(() => {
      res.write('data: {"type":"ping"}\n\n');
    }, SSE_KEEPALIVE_INTERVAL_MS);

    // Cleanup on close
    req.on('close', () => {
      console.log(`[ideation-sse] Client disconnected for session: ${id || 'all'}`);
      clearInterval(keepAliveInterval);
      ideationEvents.off('session', handler);
    });
  }

  // ===========================================================================
  // Navigator Chat (#cv2-045)
  // ===========================================================================

  async function navigatorChat(req: Request, res: Response): Promise<void> {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (!isNavigatorActive()) {
        res.status(503).json({
          error: 'Navigator not available',
          message: 'Navigator service is not initialized. Check ANTHROPIC_API_KEY.',
        });
        return;
      }

      const response = await navigatorService.generateResponse(message);
      res.json({ response });
    } catch (error) {
      console.error('Error in Navigator chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Navigator error', message: errorMessage });
    }
  }

  return {
    createSession,
    getSession,
    listSessions,
    abandonSession,
    updateSession,
    addMessage,
    updateUnderstanding,
    sendToPlanner,
    getConfidence,
    listBlocks,
    createBlock: createBlockHandler,
    updateBlock,
    deleteBlock,
    curateBlock,
    subscribeToEvents,
    navigatorChat,
  };
}
