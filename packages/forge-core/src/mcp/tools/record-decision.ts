import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error } from '../types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';

// ============================================
// Schema
// ============================================

export const RecordDecisionSchema = z.object({
  task_id: z.string().uuid(),
  question: z.string().min(1),
  chosen: z.string().min(1),
  alternatives: z.array(z.string()).optional().default([]),
  reasoning: z.string().optional(),
});

export type RecordDecisionArgs = z.infer<typeof RecordDecisionSchema>;

// ============================================
// Tool Definition
// ============================================

export const recordDecisionTool: ToolDefinition = {
  name: 'record_decision',
  description:
    'Records a decision made during task execution. Use this to document important choices, trade-offs, and the reasoning behind them for future reference.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        format: 'uuid',
        description: 'The ID of the task where the decision was made',
      },
      question: {
        type: 'string',
        description: 'The question or problem that required a decision',
      },
      chosen: {
        type: 'string',
        description: 'The option or approach that was chosen',
      },
      alternatives: {
        type: 'array',
        items: { type: 'string' },
        description: 'Other options that were considered but not chosen',
      },
      reasoning: {
        type: 'string',
        description: 'Explanation of why this choice was made over alternatives',
      },
    },
    required: ['task_id', 'question', 'chosen'],
  },
};

// ============================================
// Result Type
// ============================================

export interface RecordDecisionResult {
  acknowledged: true;
  task_id: string;
  decision_recorded: true;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleRecordDecision(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<RecordDecisionResult> {
  // Validate arguments
  const parseResult = RecordDecisionSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { task_id, question, chosen, alternatives, reasoning } = parseResult.data;

  // Verify task exists
  const task = context.storage.getTask(task_id);
  if (!task) {
    return error(`Task not found: ${task_id}`);
  }

  // Get agent_id from task
  const agentId = task.agent_id ?? 'unknown';

  // Update agent heartbeat
  if (context.healthMonitor) {
    context.healthMonitor.trackAgentHeartbeat(agentId);
  }

  // Emit trajectory event for decision recorded
  context.trajectoryCapture.capture(
    task.run_id,
    TrajectoryEventType.DecisionRecorded,
    {
      agent_id: agentId,
      decision: chosen,
      reasoning,
      alternatives,
      context: {
        question,
        task_step_id: task.step_id,
        task_step_title: task.step_title,
      },
    },
    task_id
  );

  const timestamp = new Date().toISOString();

  return success({
    acknowledged: true,
    task_id,
    decision_recorded: true,
    timestamp,
  });
}
