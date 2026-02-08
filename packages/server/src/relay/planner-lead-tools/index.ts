/**
 * PlannerLead Tool Definitions and Handlers
 *
 * Defines the tools available to PlannerLead for Anthropic API tool use.
 * Includes both schema definitions and execution handlers.
 */

import type { PlanStorage } from '../../../../planner/src/storage/interface.js';

// Import all tool handlers
import { executeReadPlan, executeListPlans } from './plan-tools.js';
import { executeAddStep, executeEditStep } from './step-tools.js';
import {
  executeSpawnAgent,
  executeReleaseAgent,
  executeMessageAgent,
  executeListAgents,
} from './agent-relay-tools.js';
import { executeReportAgentStatus } from './agent-status-tools.js';
import { executeAskUserQuestion } from './question-tools.js';
import { executeJoinPlanChannel } from './channel-tools.js';
import { getMockToolResult } from './mock-tools.js';

// Import schemas and types
import { PLANNER_LEAD_TOOLS } from './schemas.js';
import type {
  ToolResult,
  AddStepInput,
  EditStepInput,
  SpawnAgentInput,
  MessageAgentInput,
  ReportAgentStatusInput,
  AskUserQuestionInput,
  JoinPlanChannelInput,
} from './types.js';

// Re-export schemas and types
export { PLANNER_LEAD_TOOLS };
export type {
  ToolResult,
  AddStepInput,
  EditStepInput,
  SpawnAgentInput,
  MessageAgentInput,
  ReportAgentStatusInput,
  AskUserQuestionInput,
  JoinPlanChannelInput,
};

// Re-export mock tools for testing
export { getMockToolResult };

/**
 * Execute a tool by name with given input.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  storage: PlanStorage
): Promise<ToolResult> {
  switch (toolName) {
    case 'read_plan':
      return executeReadPlan(input as unknown as { plan_id: string }, storage);
    case 'list_plans':
      return executeListPlans(input as unknown as { status?: string }, storage);
    case 'add_step':
      return executeAddStep(input as unknown as AddStepInput, storage);
    case 'edit_step':
      return executeEditStep(input as unknown as EditStepInput, storage);
    case 'spawn_agent':
      return executeSpawnAgent(input as unknown as SpawnAgentInput);
    case 'release_agent':
      return executeReleaseAgent(input as unknown as { name: string });
    case 'message_agent':
      return executeMessageAgent(input as unknown as MessageAgentInput);
    case 'list_agents':
      return executeListAgents();
    case 'report_agent_status':
      return executeReportAgentStatus(input as unknown as ReportAgentStatusInput);
    case 'ask_user_question':
      return executeAskUserQuestion(input as unknown as AskUserQuestionInput, storage);
    case 'join_plan_channel':
      return executeJoinPlanChannel(input as unknown as JoinPlanChannelInput);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
