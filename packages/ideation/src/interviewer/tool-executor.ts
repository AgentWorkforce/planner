/**
 * Interviewer Tool Executor
 *
 * Executes tools by calling storage/API.
 */

import type { IdeationStorage } from '../storage/index.js';
import type { PlannerClient } from '../api/handlers.js';
import { createTranscriptMessage, createPlannerSend, createActiveSpecialist } from '../domain/index.js';
import { ideationEvents } from '../api/events.js';
import type {
  ToolResult,
  StartSessionInput,
  ReadSessionInput,
  AddMessageInput,
  UpdateUnderstandingInput,
  SendToPlannerInput,
  SpawnSpecialistInput,
  UpdateSynthesisInput,
} from './tools.js';

// =============================================================================
// Tool Executor
// =============================================================================

export interface ToolExecutorDeps {
  storage: IdeationStorage;
  spawnAgent?: (sessionId: string, name: string, focus: string, context?: string) => Promise<string>;
  plannerClient?: PlannerClient;
}

export async function executeTool(
  name: string,
  input: unknown,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  const { storage, spawnAgent, plannerClient } = deps;

  try {
    switch (name) {
      case 'start_session': {
        const { initial_intent, initiative_id } = input as StartSessionInput;
        const session = await storage.createSession(
          { type: 'human', initial_intent },
          initiative_id
        );
        return { success: true, data: { session_id: session.id } };
      }

      case 'read_session': {
        const { session_id } = input as ReadSessionInput;
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }
        return { success: true, data: session };
      }

      case 'add_message': {
        const { session_id, role, content } = input as AddMessageInput;
        const message = createTranscriptMessage(role, content);
        const session = await storage.appendTranscript(session_id, message);
        return { success: true, data: { message_id: message.id } };
      }

      case 'update_understanding': {
        const { session_id, specialist_name, observations } = input as UpdateUnderstandingInput;
        const session = await storage.updateUnderstanding(session_id, specialist_name, observations);
        // Emit event so SSE clients get notified
        ideationEvents.emitSessionEvent('session:understanding', session);
        return { success: true, data: { updated: true } };
      }

      case 'send_to_planner': {
        const { session_id, goal, context } = input as SendToPlannerInput;
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Build payload
        const payload = {
          goal: goal ?? session.source.initial_intent,
          context,
          source: { type: 'ideation' as const, session_id },
          understanding: session.understanding,
          initiative_id: session.initiative_id,
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
          // No planner client - fail loudly
          return { success: false, error: 'Planner service unavailable. No planner client configured.' };
        }

        const send = createPlannerSend(payload, result);
        await storage.appendPlannerSend(session_id, send);

        return { success: true, data: result };
      }

      case 'spawn_specialist': {
        const { session_id, name, focus, prompt_context } = input as SpawnSpecialistInput;

        // Check session exists
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Check if specialist already spawned
        const existing = session.active_specialists.find(s => s.name === name);
        if (existing) {
          return {
            success: true,
            data: {
              agent_id: existing.agent_id,
              already_active: true,
              message: `${name} specialist is already active for this session. Do NOT attempt to spawn them again. Proceed to respond to the user.`,
            },
          };
        }

        // Spawn via relay (or mock)
        let agentId: string;
        if (spawnAgent) {
          agentId = await spawnAgent(session_id, name, focus, prompt_context);
        } else {
          // No spawnAgent - fail loudly
          return { success: false, error: 'Agent spawning unavailable. No spawnAgent callback configured.' };
        }

        // Record in session
        const specialist = createActiveSpecialist(name, agentId, focus);
        await storage.addActiveSpecialist(session_id, specialist);

        return { success: true, data: { agent_id: agentId, name, focus } };
      }

      case 'update_synthesis': {
        const { session_id, idea_summary, specialist_perspectives } = input as UpdateSynthesisInput;

        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Update synthesized field via storage
        const updatedSession = await storage.updateSynthesis(session_id, {
          idea_summary,
          specialist_perspectives,
        });

        // Emit SSE event for UI update
        ideationEvents.emitSessionEvent('session:synthesis_updated', updatedSession);

        return { success: true, data: { updated: true } };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[tool-executor] Error executing tool '${name}':`, error);
    return { success: false, error: message };
  }
}
