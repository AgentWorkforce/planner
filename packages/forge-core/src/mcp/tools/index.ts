import type {
  ToolDefinition,
  ToolHandlerContext,
  ToolResponse,
  CallToolResult,
} from '../types.js';
import { error, toCallToolResult } from '../types.js';

// Import tool definitions and handlers
import { reportProgressTool, handleReportProgress } from './report-progress.js';
import { reportCompleteTool, handleReportComplete } from './report-complete.js';
import { reportBlockedTool, handleReportBlocked } from './report-blocked.js';
import { requestHumanInputTool, handleRequestHumanInput } from './request-human-input.js';
import { recordDecisionTool, handleRecordDecision } from './record-decision.js';
import { reportAuditResultTool, handleReportAuditResult } from './report-audit-result.js';

// ============================================
// Tool Registry
// ============================================

/**
 * All available MCP tools for agent communication
 */
export const tools: ToolDefinition[] = [
  reportProgressTool,
  reportCompleteTool,
  reportBlockedTool,
  requestHumanInputTool,
  recordDecisionTool,
  reportAuditResultTool,
];

/**
 * Map of tool names to their definitions
 */
export const toolRegistry: Map<string, ToolDefinition> = new Map(
  tools.map((tool) => [tool.name, tool])
);

// ============================================
// Handler Registry
// ============================================

type ToolHandler = (
  context: ToolHandlerContext,
  args: unknown
) => ToolResponse<unknown>;

/**
 * Map of tool names to their handlers
 */
const handlerRegistry = new Map<string, ToolHandler>([
  ['report_progress', handleReportProgress as ToolHandler],
  ['report_complete', handleReportComplete as ToolHandler],
  ['report_blocked', handleReportBlocked as ToolHandler],
  ['request_human_input', handleRequestHumanInput as ToolHandler],
  ['record_decision', handleRecordDecision as ToolHandler],
  ['report_audit_result', handleReportAuditResult as ToolHandler],
]);

// ============================================
// Tool Call Handler
// ============================================

/**
 * Result of validating a task belongs to an active run
 */
interface TaskValidationResult {
  valid: boolean;
  error?: string;
  runId?: string;
}

/**
 * Validates that a task_id belongs to an active run
 */
function validateTaskBelongsToActiveRun(
  context: ToolHandlerContext,
  args: Record<string, unknown>
): TaskValidationResult {
  const taskId = args.task_id;

  if (typeof taskId !== 'string') {
    return { valid: false, error: 'task_id is required and must be a string' };
  }

  const task = context.storage.getTask(taskId);
  if (!task) {
    return { valid: false, error: `Task not found: ${taskId}` };
  }

  const run = context.storage.getRun(task.run_id);
  if (!run) {
    return { valid: false, error: `Run not found for task: ${taskId}` };
  }

  // Check if run is in an active state
  const activeStates = ['running', 'paused'];
  if (!activeStates.includes(run.status)) {
    return {
      valid: false,
      error: `Task belongs to run in '${run.status}' status. Run must be 'running' or 'paused'.`,
    };
  }

  return { valid: true, runId: run.run_id };
}

/**
 * Handles a tool call by name with the given arguments
 *
 * @param context - The tool handler context with storage and services
 * @param name - Name of the tool to call
 * @param args - Arguments to pass to the tool
 * @returns ToolResponse with the result or error
 */
export function handleToolCall(
  context: ToolHandlerContext,
  name: string,
  args: unknown
): ToolResponse<unknown> {
  // Find the tool handler
  const handler = handlerRegistry.get(name);
  if (!handler) {
    return error(`Unknown tool: ${name}`);
  }

  // Validate args is an object
  if (typeof args !== 'object' || args === null) {
    return error('Arguments must be an object');
  }

  const argsObj = args as Record<string, unknown>;

  // Validate task belongs to active run (for tools that have task_id)
  if ('task_id' in argsObj) {
    const validation = validateTaskBelongsToActiveRun(context, argsObj);
    if (!validation.valid) {
      return error(validation.error!);
    }
  }

  // Call the handler
  return handler(context, args);
}

/**
 * Handles a tool call and returns MCP SDK compatible result
 *
 * @param context - The tool handler context with storage and services
 * @param name - Name of the tool to call
 * @param args - Arguments to pass to the tool
 * @returns CallToolResult in MCP SDK format
 */
export function handleToolCallMCP(
  context: ToolHandlerContext,
  name: string,
  args: unknown
): CallToolResult {
  const response = handleToolCall(context, name, args);
  return toCallToolResult(response);
}

// ============================================
// Re-exports for convenience
// ============================================

export {
  // Tool definitions
  reportProgressTool,
  reportCompleteTool,
  reportBlockedTool,
  requestHumanInputTool,
  recordDecisionTool,
  reportAuditResultTool,
  // Handlers
  handleReportProgress,
  handleReportComplete,
  handleReportBlocked,
  handleRequestHumanInput,
  handleRecordDecision,
  handleReportAuditResult,
};

// Re-export types
export type {
  ReportProgressArgs,
  ReportProgressResult,
} from './report-progress.js';
export type {
  ReportCompleteArgs,
  ReportCompleteResult,
} from './report-complete.js';
export type {
  ReportBlockedArgs,
  ReportBlockedResult,
} from './report-blocked.js';
export type {
  RequestHumanInputArgs,
  RequestHumanInputResult,
} from './request-human-input.js';
export type {
  RecordDecisionArgs,
  RecordDecisionResult,
} from './record-decision.js';
export type {
  ReportAuditResultArgs,
  ReportAuditResultResult,
} from './report-audit-result.js';
