/**
 * Plan channel tools for PlannerLead.
 */

import { getClient } from '../client.js';
import type { ToolResult, JoinPlanChannelInput } from './types.js';

/**
 * Execute join_plan_channel tool.
 * Joins the agent to a plan's relay channel.
 */
export async function executeJoinPlanChannel(input: JoinPlanChannelInput): Promise<ToolResult> {
  try {
    const client = getClient();
    if (!client) {
      return {
        success: false,
        error: 'Not connected to relay daemon',
      };
    }

    const channel = `#plan-${input.plan_id.slice(0, 8)}`;
    const joined = client.adminJoinChannel(channel, input.agent_id);

    if (!joined) {
      return {
        success: false,
        error: `Failed to join channel ${channel}`,
      };
    }

    return {
      success: true,
      result: {
        agent_id: input.agent_id,
        channel,
        message: `Successfully joined channel ${channel}`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
