import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error } from '../types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import { TaskStatus } from '../../domain/types.js';

// ============================================
// Schema
// ============================================

const SuggestedChangeSchema = z.object({
  type: z.enum([
    'add_step',
    'remove_step',
    'modify_step',
    'add_dependency',
    'remove_dependency',
  ]),
  step_id: z.string().optional(),
  description: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export const ReportBlockedSchema = z.object({
  task_id: z.string().uuid(),
  reason: z.string().min(1),
  suggested_change: SuggestedChangeSchema.optional(),
});

export type ReportBlockedArgs = z.infer<typeof ReportBlockedSchema>;

// ============================================
// Tool Definition
// ============================================

export const reportBlockedTool: ToolDefinition = {
  name: 'report_blocked',
  description:
    'Reports that a task is blocked and cannot proceed. Optionally suggest a plan change to resolve the blocker.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        format: 'uuid',
        description: 'The ID of the blocked task',
      },
      reason: {
        type: 'string',
        description: 'Explanation of why the task is blocked',
      },
      suggested_change: {
        type: 'object',
        description: 'Optional suggested change to the plan to resolve the blocker',
        properties: {
          type: {
            type: 'string',
            enum: [
              'add_step',
              'remove_step',
              'modify_step',
              'add_dependency',
              'remove_dependency',
            ],
            description: 'Type of change suggested',
          },
          step_id: {
            type: 'string',
            description: 'Step ID affected by the change (if applicable)',
          },
          description: {
            type: 'string',
            description: 'Description of the suggested change',
          },
          details: {
            type: 'object',
            description: 'Additional details about the change',
          },
        },
        required: ['type', 'description'],
      },
    },
    required: ['task_id', 'reason'],
  },
};

// ============================================
// Result Type
// ============================================

export interface ReportBlockedResult {
  task_id: string;
  new_status: string;
  change_request_created: boolean;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleReportBlocked(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<ReportBlockedResult> {
  // Validate arguments
  const parseResult = ReportBlockedSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { task_id, reason, suggested_change } = parseResult.data;

  // Verify task exists
  const task = context.storage.getTask(task_id);
  if (!task) {
    return error(`Task not found: ${task_id}`);
  }

  // Verify task is in a state where blocking can be reported
  if (task.status !== 'running' && task.status !== 'queued') {
    return error(
      `Cannot report blocked for task in status '${task.status}'. Task must be 'running' or 'queued'.`
    );
  }

  // Get agent_id from task
  const agentId = task.agent_id ?? 'unknown';

  // Update task status to blocked
  const updatedTask = context.storage.updateTaskStatus(task_id, TaskStatus.Blocked);
  if (!updatedTask) {
    return error(`Failed to update task status: ${task_id}`);
  }

  // Update agent heartbeat
  if (context.healthMonitor) {
    context.healthMonitor.trackAgentHeartbeat(agentId);
  }

  // Emit trajectory event
  context.trajectoryCapture.capture(
    task.run_id,
    TrajectoryEventType.TaskBlocked,
    {
      step_id: task.step_id,
      step_title: task.step_title,
      reason,
      suggested_change: suggested_change
        ? {
            type: suggested_change.type,
            step_id: suggested_change.step_id,
            description: suggested_change.description,
          }
        : undefined,
    },
    task_id
  );

  // If suggested_change is provided, emit SSE event for change request
  // The orchestrator or API layer would handle creating the actual ChangeRequest
  let changeRequestCreated = false;
  if (suggested_change && context.emitSSE) {
    context.emitSSE('change_request_suggested', {
      run_id: task.run_id,
      task_id,
      reason,
      suggested_changes: [suggested_change],
    });
    changeRequestCreated = true;
  }

  const timestamp = new Date().toISOString();

  return success({
    task_id,
    new_status: TaskStatus.Blocked,
    change_request_created: changeRequestCreated,
    timestamp,
  });
}
