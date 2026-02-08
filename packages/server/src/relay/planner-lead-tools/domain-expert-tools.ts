/**
 * Domain expert tools for PlannerLead.
 * Sends questions to the Interviewer agent in plan channels.
 */

import { sendChannelMessage } from '../client.js';
import { getPlanChannelId } from '../channels.js';
import { getSessionForPlanChannel } from '../ideation-bridge.js';
import type { ToolResult, AskDomainExpertInput } from './types.js';

/**
 * Execute ask_domain_expert tool.
 * Sends a question to the Interviewer in the plan's relay channel.
 */
export async function executeAskDomainExpert(
  input: AskDomainExpertInput
): Promise<ToolResult> {
  try {
    const channelId = getPlanChannelId(input.plan_id);
    const sessionId = getSessionForPlanChannel(channelId);

    if (!sessionId) {
      return {
        success: false,
        error: 'No domain expert available for this plan. Use ask_user_question instead.',
      };
    }

    const messageData: Record<string, unknown> = {
      type: 'domain_question',
      fromAgent: 'PlannerLead',
    };
    if (input.context) {
      messageData.context = input.context;
    }

    const sent = sendChannelMessage(channelId, input.question, messageData);

    if (!sent) {
      return { success: false, error: 'Failed to send question to domain expert. Relay may not be connected.' };
    }

    return {
      success: true,
      result: {
        message: 'Question sent to domain expert (Interviewer). The response will arrive as a channel message.',
        channel: channelId,
        session_id: sessionId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
