/**
 * MCP Tools - All available tools with their schemas and handlers.
 *
 * This file combines all domain-specific tool modules and provides
 * a unified interface for tool execution.
 */

import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { toCallToolResult, type ToolResponse } from './types.js';

// Import tool schemas
import { planTools, handleListPlans, handleReadPlan, handleCreatePlan, handleSubmitPlan, handleApprovePlan, handlePublishPlan } from './plan-tools.js';
import { stepTools, handleAddStep, handleEditStep, handleRemoveStep, handleSetDependencies } from './step-tools.js';
import { criteriaTools, handleAddCriteria, handleRemoveCriteria, handleEditCriteria } from './criteria-tools.js';
import { gateTools, handleAddGate, handleRemoveGate } from './gate-tools.js';
import { versionTools, handleCreateDraftVersion, handleRestoreVersion } from './version-tools.js';
import { improvementTools, handleSuggestImprovement } from './improvement-tools.js';

// Re-export shared types and utilities
export { success, error, checkVersionConflict } from './shared.js';
export type { ToolResponse, VersionConflictResponse } from './shared.js';

/**
 * All available tools with their schemas.
 * Standalone version - no relay-dependent tools.
 */
export const tools: Tool[] = [
  ...planTools,
  ...stepTools,
  ...criteriaTools,
  ...gateTools,
  ...versionTools,
  ...improvementTools,
];

/**
 * Handle a tool call by name.
 */
export function handleToolCall(
  storage: PlanStorage,
  name: string,
  args: Record<string, unknown>
): CallToolResult {
  const response = executeToolCall(storage, name, args);
  return toCallToolResult(response);
}

/**
 * Execute a tool call by name and return the response.
 */
function executeToolCall(
  storage: PlanStorage,
  name: string,
  args: Record<string, unknown>
): ToolResponse {
  switch (name) {
    // Plan tools
    case 'list_plans':
      return handleListPlans(storage, args);
    case 'read_plan':
      return handleReadPlan(storage, args);
    case 'create_plan':
      return handleCreatePlan(storage, args);
    case 'submit_plan':
      return handleSubmitPlan(storage, args);
    case 'approve_plan':
      return handleApprovePlan(storage, args);
    case 'publish_plan':
      return handlePublishPlan(storage, args);

    // Step tools
    case 'add_step':
      return handleAddStep(storage, args);
    case 'edit_step':
      return handleEditStep(storage, args);
    case 'remove_step':
      return handleRemoveStep(storage, args);
    case 'set_dependencies':
      return handleSetDependencies(storage, args);

    // Criteria tools
    case 'add_criteria':
      return handleAddCriteria(storage, args);
    case 'remove_criteria':
      return handleRemoveCriteria(storage, args);
    case 'edit_criteria':
      return handleEditCriteria(storage, args);

    // Gate tools
    case 'add_gate':
      return handleAddGate(storage, args);
    case 'remove_gate':
      return handleRemoveGate(storage, args);

    // Version tools
    case 'create_draft_version':
      return handleCreateDraftVersion(storage, args);
    case 'restore_version':
      return handleRestoreVersion(storage, args);

    // Improvement tools
    case 'suggest_improvement':
      return handleSuggestImprovement(storage, args);

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
