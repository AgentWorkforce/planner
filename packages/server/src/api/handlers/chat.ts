/**
 * Chat API Handlers
 *
 * Provides relay-aware chat functionality:
 * - Routes messages to planning agents via relay when session exists
 * - Falls back to mock responses when no active session
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getRelayMode,
  sendToAgent,
  type AgentResponse,
} from '../../relay/index.js';

// Import mock response from planner package
import {
  createMockChatResponse,
  type ChatSuggestion,
  notFound,
  badRequest,
} from '../../../../planner/src/index.js';

/**
 * Chat context from the UI
 */
interface ChatContext {
  plan_id: string;
  version: number;
  goal: string;
  context?: string;
  steps: {
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    dependencies: string[];
    acceptance_criteria_count: number;
    has_gate: boolean;
  }[];
}

/**
 * Chat message from history
 */
interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Chat request body
 */
interface ChatRequestBody {
  message: string;
  context: ChatContext;
  history?: ChatHistoryMessage[];
}

/**
 * Chat response
 */
interface ChatResponse {
  message: string;
  suggestion?: ChatSuggestion;
  session_status: 'active' | 'none';
}

/**
 * Parse suggestions from agent response text.
 * Agent can embed suggestions in a structured format.
 */
function parseSuggestionFromResponse(text: string): { message: string; suggestion?: ChatSuggestion } {
  // Look for suggestion block in format:
  // [SUGGESTION type="add_step" description="..." preview="..."]
  // { json data }
  // [/SUGGESTION]
  const suggestionRegex = /\[SUGGESTION type="([^"]+)" description="([^"]+)" preview="([^"]*)"\]\s*(\{[\s\S]*?\})\s*\[\/SUGGESTION\]/;
  const match = text.match(suggestionRegex);

  if (match) {
    const [fullMatch, type, description, preview, jsonData] = match;
    if (type && description && jsonData) {
      try {
        const data = JSON.parse(jsonData);
        const message = text.replace(fullMatch, '').trim();
        return {
          message: message || 'Here\'s my suggestion:',
          suggestion: {
            type: type as ChatSuggestion['type'],
            description,
            preview: preview || '',
            data,
          },
        };
      } catch {
        // Invalid JSON, return as plain text
        return { message: text };
      }
    }
  }

  return { message: text };
}

/** Storage interface subset needed for chat handlers */
interface ChatStorage {
  getPlan(planId: string): { plan_id: string } | null;
  getSessionByPlanId(planId: string): { session_id: string; agent_id: string } | null;
  getLatestVersion(planId: string): { steps?: Array<{ title: string }> } | null;
}

/**
 * Create relay-aware chat handlers.
 */
export function createChatHandlers(storage: ChatStorage) {
  return {
    /**
     * POST /ai/chat
     * Send a chat message to the planning agent.
     * Routes via relay when session exists, falls back to mock otherwise.
     */
    chat: async (req: Request<unknown, unknown, ChatRequestBody>, res: Response, next: NextFunction) => {
      try {
        const { message, context, history } = req.body;

        if (!message || typeof message !== 'string') {
          throw badRequest('message is required');
        }
        if (!context || !context.plan_id) {
          throw badRequest('context with plan_id is required');
        }

        const planId = context.plan_id;
        const mode = getRelayMode();

        // Check if plan exists
        const plan = storage.getPlan(planId);
        if (!plan) {
          throw notFound('Plan');
        }

        // Check for active session
        const session = storage.getSessionByPlanId(planId);

        if (!session || mode !== 'connected') {
          // No active session or relay not connected - return mock response
          console.log(`[chat] No active session or relay not connected for plan ${planId}, using mock response`);
          const version = storage.getLatestVersion(planId);
          if (!version) {
            throw notFound('Plan version');
          }
          const mockResponse = createMockChatResponse(message, context, version as any);
          res.json({
            ...mockResponse,
            session_status: 'none',
            mode,
          });
          return;
        }

        // Send to agent via relay
        console.log(`[chat] Sending message to agent ${session.agent_id} for plan ${planId}`);
        try {
          const agentResponse = await sendToAgent(session.agent_id, message, {
            plan_id: planId,
            context,
            history: history || [],
          });

          // Parse response for suggestions
          const { message: responseMessage, suggestion } = parseSuggestionFromResponse(agentResponse.text);

          const chatResponse: ChatResponse = {
            message: responseMessage,
            suggestion,
            session_status: 'active',
          };

          res.json(chatResponse);
        } catch (err) {
          // Agent communication failed - fall back to mock
          const errMessage = err instanceof Error ? err.message : String(err);
          console.error(`[chat] Agent communication failed: ${errMessage}`);

          // Check if timeout
          if (errMessage.includes('TIMEOUT')) {
            res.json({
              message: 'The AI agent is taking too long to respond. Please try again.',
              session_status: 'active',
            });
            return;
          }

          // Other error - return mock with error context
          const version = storage.getLatestVersion(planId);
          if (!version) {
            throw notFound('Plan version');
          }
          const mockResponse = createMockChatResponse(message, context, version as any);
          res.json({
            ...mockResponse,
            session_status: 'active',
            error: 'Agent temporarily unavailable, showing fallback response',
          });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}
