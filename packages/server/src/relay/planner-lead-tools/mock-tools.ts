/**
 * Mock tool results for demo mode.
 */

import type { ToolResult } from './types.js';

/**
 * Get mock tool result for demo mode.
 */
export function getMockToolResult(toolName: string, input: Record<string, unknown>): ToolResult {
  switch (toolName) {
    case 'read_plan':
      return {
        success: true,
        result: {
          plan_id: input.plan_id || 'demo-plan',
          goal: 'Demo plan goal - this is mock data',
          status: 'draft',
          step_count: 3,
          steps: [
            { step_id: 'step-1', title: 'First step', dependencies: [] },
            { step_id: 'step-2', title: 'Second step', dependencies: ['step-1'] },
            { step_id: 'step-3', title: 'Third step', dependencies: ['step-2'] },
          ],
        },
      };
    case 'list_plans':
      return {
        success: true,
        result: [
          { plan_id: 'demo-1', goal: 'Demo plan 1', status: 'draft', step_count: 3 },
          { plan_id: 'demo-2', goal: 'Demo plan 2', status: 'approved', step_count: 5 },
        ],
      };
    case 'add_step':
      return {
        success: true,
        result: {
          step_id: 'mock-step-id',
          title: input.title || 'New step',
          message: '[Mock] Step would be added in production',
        },
      };
    case 'edit_step':
      return {
        success: true,
        result: {
          step_id: input.step_id || 'mock-step-id',
          title: input.title || 'Edited step',
          message: '[Mock] Step would be updated in production',
        },
      };
    case 'spawn_agent':
      return {
        success: true,
        result: {
          name: input.name || 'mock-agent',
          pid: 12345,
          message: '[Mock] Agent would be spawned in production',
        },
      };
    case 'release_agent':
      return {
        success: true,
        result: {
          name: input.name || 'mock-agent',
          message: '[Mock] Agent would be released in production',
        },
      };
    case 'message_agent':
      return {
        success: true,
        result: {
          agent_name: input.agent_name || 'mock-agent',
          message: '[Mock] Message would be sent in production',
        },
      };
    case 'list_agents':
      return {
        success: true,
        result: {
          agents: [
            { name: 'mock-worker-1', pid: 12345, uptime: 120 },
            { name: 'mock-worker-2', pid: 12346, uptime: 60 },
          ],
          message: '[Mock] 2 agent(s) currently spawned.',
        },
      };
    case 'report_agent_status':
      return {
        success: true,
        result: {
          agent_id: input.agent_id || 'mock-agent',
          registered: true,
          state: input.state || 'idle',
          message: '[Mock] Agent status would be registered/updated in production',
        },
      };
    case 'ask_user_question':
      return {
        success: true,
        result: {
          question_id: 'mock-question-id',
          plan_id: String(input.plan_id || 'mock-plan'),
          agent_id: String(input.agent_id || 'mock-agent'),
          message: '[Mock] Question would be submitted in production',
        },
      };
    case 'join_plan_channel':
      return {
        success: true,
        result: {
          agent_id: input.agent_id || 'mock-agent',
          channel: `#plan-${String(input.plan_id || 'mock').slice(0, 8)}`,
          message: '[Mock] Would join channel in production',
        },
      };
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
