/**
 * Interviewer Tool Executor
 *
 * Executes tools by calling storage/API.
 */

import type { IdeationStorage } from '../storage/index.js';
import { createTranscriptMessage, createPlannerSend, createActiveSpecialist } from '../domain/index.js';
import type {
  ToolResult,
  StartSessionInput,
  ReadSessionInput,
  AddMessageInput,
  UpdateUnderstandingInput,
  SendToPlannerInput,
  SpawnSpecialistInput,
} from './tools.js';

// =============================================================================
// Tool Executor
// =============================================================================

export interface ToolExecutorDeps {
  storage: IdeationStorage;
  spawnAgent?: (sessionId: string, name: string, focus: string, context?: string) => Promise<string>;
}

export async function executeTool(
  name: string,
  input: unknown,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  const { storage, spawnAgent } = deps;

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

        // TODO: Actually call planner API (implemented in ideation-planner-handoff)
        const result = {
          plan_id: `plan-${Date.now()}`,
          plan_version: 1,
        };

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
          return { success: true, data: { agent_id: existing.agent_id, already_active: true } };
        }

        // Spawn via relay (or mock)
        let agentId: string;
        if (spawnAgent) {
          agentId = await spawnAgent(session_id, name, focus, prompt_context);
        } else {
          // Mock mode - generate fake agent ID
          agentId = `mock-${name.toLowerCase()}-${Date.now()}`;
        }

        // Record in session
        const specialist = createActiveSpecialist(name, agentId, focus);
        await storage.addActiveSpecialist(session_id, specialist);

        return { success: true, data: { agent_id: agentId, name, focus } };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

// =============================================================================
// Mock Tool Results (for testing without LLM)
// =============================================================================

export function getMockToolResult(name: string, input: unknown): ToolResult {
  switch (name) {
    case 'start_session':
      return { success: true, data: { session_id: `mock-session-${Date.now()}` } };

    case 'read_session':
      return {
        success: true,
        data: {
          id: (input as ReadSessionInput).session_id,
          status: 'active',
          transcript: [],
          understanding: {},
          active_specialists: [],
          planner_sends: [],
        },
      };

    case 'add_message':
      return { success: true, data: { message_id: `mock-msg-${Date.now()}` } };

    case 'update_understanding':
      return { success: true, data: { updated: true } };

    case 'send_to_planner':
      return { success: true, data: { plan_id: `mock-plan-${Date.now()}`, plan_version: 1 } };

    case 'spawn_specialist': {
      const { name } = input as SpawnSpecialistInput;
      return { success: true, data: { agent_id: `mock-${name.toLowerCase()}-${Date.now()}` } };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
