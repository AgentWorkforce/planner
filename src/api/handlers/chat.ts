/**
 * Chat API Handlers
 *
 * Provides endpoints for AI chat functionality.
 * Routes messages to planning agents via relay when available,
 * falls back to mock responses when no active session.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound, badRequest } from '../middleware.js';
import { sendToAgent, type AgentResponse } from '../../relay/chat.js';
import { createMockChatResponse } from './chat-mock.js';
import {
  addStepToPlan,
  editStepInPlan,
  removeStepFromPlan,
  addCriteriaToStep,
  editCriteriaInStep,
} from '../../domain/plan-operations.js';

interface PlanIdParams {
  id: string;
}

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
 * Suggestion in chat response
 */
export interface ChatSuggestion {
  type: 'add_step' | 'edit_step' | 'remove_step' | 'add_criteria' | 'edit_criteria';
  description: string;
  preview: string;
  data: Record<string, unknown>;
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

/**
 * Creates chat route handlers with injected storage dependency.
 */
export function createChatHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /ai/chat
     * Send a chat message to the planning agent.
     * Falls back to mock response when no active session.
     */
    chat: async (req: Request<PlanIdParams, unknown, ChatRequestBody>, res: Response, next: NextFunction) => {
      try {
        const { message, context, history } = req.body;

        if (!message || typeof message !== 'string') {
          throw badRequest('message is required');
        }
        if (!context || !context.plan_id) {
          throw badRequest('context with plan_id is required');
        }

        const planId = context.plan_id;

        // Check if plan exists
        const plan = storage.getPlan(planId);
        if (!plan) {
          throw notFound('Plan');
        }

        // Check for active session
        const session = storage.getSessionByPlanId(planId);

        if (!session) {
          // No active session - return mock response
          console.log(`[chat] No active session for plan ${planId}, using mock response`);
          const version = storage.getLatestVersion(planId);
          if (!version) {
            throw notFound('Plan version');
          }
          const mockResponse = createMockChatResponse(message, context, version);
          res.json({
            ...mockResponse,
            session_status: 'none',
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

          // Other error - return mock
          const version = storage.getLatestVersion(planId);
          if (!version) {
            throw notFound('Plan version');
          }
          const mockResponse = createMockChatResponse(message, context, version);
          res.json({
            ...mockResponse,
            session_status: 'active', // Session exists but agent failed
          });
        }
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /ai/suggestions/apply
     * Apply a suggestion from the chat.
     */
    applySuggestion: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { plan_id, version, suggestion_type, suggestion_data } = req.body;

        if (!plan_id || !version || !suggestion_type || !suggestion_data) {
          throw badRequest('plan_id, version, suggestion_type, and suggestion_data are required');
        }

        // Check if plan exists
        const plan = storage.getPlan(plan_id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Check version exists
        const planVersion = storage.getVersion(plan_id, version);
        if (!planVersion) {
          throw notFound('Version');
        }

        // Apply the suggestion based on type using shared plan operations
        switch (suggestion_type) {
          case 'add_step': {
            const result = addStepToPlan(
              storage,
              plan_id,
              {
                title: suggestion_data.title as string,
                description: suggestion_data.description as string | undefined,
                scope: suggestion_data.scope as string | undefined,
                owner_role: suggestion_data.owner_role as string | undefined,
                dependencies: suggestion_data.dependencies as string[] | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
            });
            return;
          }

          case 'edit_step': {
            const stepId = suggestion_data.step_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for edit_step');
            }

            const result = editStepInPlan(
              storage,
              plan_id,
              stepId,
              {
                title: suggestion_data.title as string | undefined,
                description: suggestion_data.description as string | undefined,
                scope: suggestion_data.scope as string | undefined,
                owner_role: suggestion_data.owner_role as string | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
            });
            return;
          }

          case 'remove_step': {
            const stepId = suggestion_data.step_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for remove_step');
            }

            const result = removeStepFromPlan(storage, plan_id, stepId, version);

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              removed: true,
              step_id: stepId,
            });
            return;
          }

          case 'add_criteria': {
            const stepId = suggestion_data.step_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for add_criteria');
            }

            const result = addCriteriaToStep(
              storage,
              plan_id,
              stepId,
              {
                description: suggestion_data.description as string,
                type: suggestion_data.type as string | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
              criterion: result.data?.criterion,
            });
            return;
          }

          case 'edit_criteria': {
            const stepId = suggestion_data.step_id as string;
            const criteriaId = suggestion_data.criteria_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for edit_criteria');
            }
            if (!criteriaId) {
              throw badRequest('criteria_id is required for edit_criteria');
            }

            const result = editCriteriaInStep(
              storage,
              plan_id,
              stepId,
              criteriaId,
              {
                description: suggestion_data.description as string | undefined,
                type: suggestion_data.type as string | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
              criterion: result.data?.criterion,
            });
            return;
          }

          default:
            throw badRequest(`Unknown suggestion type: ${suggestion_type}`);
        }
      } catch (err) {
        next(err);
      }
    },
  };
}
