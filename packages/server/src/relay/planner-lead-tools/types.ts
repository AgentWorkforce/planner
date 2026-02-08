/**
 * Shared types for PlannerLead tools.
 */

import type { AgentRole, AgentState } from '../agent-status.js';

/** Tool result type */
export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/** Input type for add_step */
export interface AddStepInput {
  plan_id: string;
  title: string;
  description?: string;
  scope?: string;
  dependencies?: string[];
  owner_role?: string;
  acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
}

/** Input type for edit_step */
export interface EditStepInput {
  plan_id: string;
  step_id: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  scope?: string;
  owner_role?: string;
  acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
}

/** Input type for remove_step */
export interface RemoveStepInput {
  plan_id: string;
  step_id: string;
}

/** Input type for spawn_agent */
export interface SpawnAgentInput {
  name: string;
  task: string;
  cwd?: string;
  initial_message?: string;
}

/** Input type for message_agent */
export interface MessageAgentInput {
  agent_name: string;
  message: string;
}

/** Input type for report_agent_status */
export interface ReportAgentStatusInput {
  agent_id: string;
  role: AgentRole;
  display_name?: string;
  state: AgentState;
  activity?: string;
  thought?: string;
}

/** Input type for ask_user_question */
export interface AskUserQuestionInput {
  agent_id: string;
  agent_role: string;
  plan_id: string;
  text: string;
  context?: string;
  options?: string[];
  blocking_level?: 'hard_block' | 'soft_block' | 'preference' | 'fyi';
}

/** Input type for join_plan_channel */
export interface JoinPlanChannelInput {
  agent_id: string;
  plan_id: string;
}

/** Input type for ask_domain_expert */
export interface AskDomainExpertInput {
  plan_id: string;
  question: string;
  context?: string;
}
