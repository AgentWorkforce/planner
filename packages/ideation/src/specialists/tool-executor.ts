/**
 * Specialist Tool Executor
 *
 * Executes specialist MCP tools.
 * Observations are NOT validated - intelligence lives in prompts.
 */

import type { IdeationStorage } from '../storage/index.js';
import { specialistQueue } from '../interviewer/specialist-queue.js';
import type {
  SpecialistToolResult,
  UpdateObservationsInput,
  ReadUnderstandingInput,
  QueueInsightInput,
} from './tools.js';

// =============================================================================
// Tool Executor Dependencies
// =============================================================================

export interface SpecialistToolExecutorDeps {
  storage: IdeationStorage;
}

// =============================================================================
// Tool Executor
// =============================================================================

/**
 * Execute a specialist tool.
 *
 * @param specialistName - Name of the specialist executing the tool
 * @param toolName - Name of the tool to execute
 * @param input - Tool input (varies by tool)
 * @param deps - Dependencies (storage)
 * @returns Tool result
 */
export async function executeSpecialistTool(
  specialistName: string,
  toolName: string,
  input: unknown,
  deps: SpecialistToolExecutorDeps
): Promise<SpecialistToolResult> {
  const { storage } = deps;

  try {
    switch (toolName) {
      case 'update_observations': {
        const { session_id, observations } = input as UpdateObservationsInput;

        // Update understanding for this specialist
        // Note: No validation - freeform observations
        await storage.updateUnderstanding(session_id, specialistName, observations);

        return { success: true, data: { updated: true } };
      }

      case 'read_understanding': {
        const { session_id } = input as ReadUnderstandingInput;

        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        return {
          success: true,
          data: {
            understanding: session.understanding,
            active_specialists: session.active_specialists.map(s => s.name),
          },
        };
      }

      case 'queue_insight': {
        const { session_id, type, content, priority } = input as QueueInsightInput;

        // Get session to verify it exists
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Queue insight for Interviewer
        // Use first 8 chars of session ID as key (matches Interviewer's format)
        specialistQueue.queueInput(session_id.slice(0, 8), {
          specialist_name: specialistName,
          type,
          content,
          priority: Math.max(1, Math.min(10, priority)),
        });

        return { success: true, data: { queued: true } };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

// =============================================================================
// Mock Tool Results (for testing without LLM)
// =============================================================================

export function getMockSpecialistToolResult(
  specialistName: string,
  toolName: string,
  input: unknown
): SpecialistToolResult {
  switch (toolName) {
    case 'update_observations':
      return { success: true, data: { updated: true } };

    case 'read_understanding':
      return {
        success: true,
        data: {
          understanding: {
            [specialistName]: { mock: true, confidence: 'exploring' },
          },
          active_specialists: [specialistName],
        },
      };

    case 'queue_insight':
      return { success: true, data: { queued: true } };

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
