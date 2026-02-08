/**
 * Agent status reporting tools for PlannerLead.
 * MCP Unified Interface for agent management.
 */

import {
  emitAgentJoined,
  emitAgentStatusUpdate,
  getActiveAgents,
} from '../agent-status.js';
import type { ToolResult, ReportAgentStatusInput } from './types.js';

/**
 * Execute report_agent_status tool.
 * Registers or updates agent state in the system.
 */
export async function executeReportAgentStatus(input: ReportAgentStatusInput): Promise<ToolResult> {
  try {
    const activeAgentsMap = getActiveAgents();
    const isNew = !activeAgentsMap.has(input.agent_id);

    if (isNew) {
      // First call - register the agent
      if (!input.display_name) {
        return {
          success: false,
          error: 'display_name is required on first call to register agent',
        };
      }

      emitAgentJoined(input.agent_id, input.role, input.display_name);

      // If not idle, also emit status update
      if (input.state !== 'idle') {
        emitAgentStatusUpdate(input.agent_id, input.state, {
          activity: input.activity,
          thought: input.thought,
        });
      }

      return {
        success: true,
        result: {
          agent_id: input.agent_id,
          registered: true,
          state: input.state,
          message: `Agent "${input.display_name}" registered with role ${input.role} in state ${input.state}`,
        },
      };
    } else {
      // Subsequent call - update state
      emitAgentStatusUpdate(input.agent_id, input.state, {
        activity: input.activity,
        thought: input.thought,
      });

      return {
        success: true,
        result: {
          agent_id: input.agent_id,
          registered: false,
          state: input.state,
          message: `Agent state updated to ${input.state}`,
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
