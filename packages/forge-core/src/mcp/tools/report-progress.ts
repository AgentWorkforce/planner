import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error } from '../types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';

// ============================================
// Schema
// ============================================

export const ReportProgressSchema = z.object({
  task_id: z.string().uuid(),
  status: z.enum(['starting', 'working', 'blocked']),
  message: z.string().min(1),
  progress_pct: z.number().min(0).max(100).optional(),
});

export type ReportProgressArgs = z.infer<typeof ReportProgressSchema>;

// ============================================
// Tool Definition
// ============================================

export const reportProgressTool: ToolDefinition = {
  name: 'report_progress',
  description:
    'Reports task execution progress. Call this periodically to indicate the agent is still working and to provide status updates.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        format: 'uuid',
        description: 'The ID of the task being worked on',
      },
      status: {
        type: 'string',
        enum: ['starting', 'working', 'blocked'],
        description:
          'Current status: starting (just began), working (in progress), blocked (waiting on something)',
      },
      message: {
        type: 'string',
        description: 'Human-readable progress message describing current activity',
      },
      progress_pct: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Optional progress percentage (0-100)',
      },
    },
    required: ['task_id', 'status', 'message'],
  },
};

// ============================================
// Result Type
// ============================================

export interface ReportProgressResult {
  acknowledged: true;
  task_id: string;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleReportProgress(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<ReportProgressResult> {
  // Validate arguments
  const parseResult = ReportProgressSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { task_id, status, message, progress_pct } = parseResult.data;

  // Verify task exists
  const task = context.storage.getTask(task_id);
  if (!task) {
    return error(`Task not found: ${task_id}`);
  }

  // Verify task is in a state where progress can be reported
  if (task.status !== 'running' && task.status !== 'auditing') {
    return error(
      `Cannot report progress for task in status '${task.status}'. Task must be 'running' or 'auditing'.`
    );
  }

  // Get agent_id from task
  const agentId = task.agent_id ?? 'unknown';

  // Update agent heartbeat for health monitoring
  if (context.healthMonitor) {
    context.healthMonitor.trackAgentHeartbeat(agentId);
  }

  // Emit trajectory event
  context.trajectoryCapture.capture(
    task.run_id,
    TrajectoryEventType.AgentProgress,
    {
      agent_id: agentId,
      message,
      progress_pct,
      current_action: status,
    },
    task_id
  );

  const timestamp = new Date().toISOString();

  return success({
    acknowledged: true,
    task_id,
    timestamp,
  });
}
