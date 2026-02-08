import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error } from '../types.js';
import {
  createQuestion,
  QuestionBlockingLevel,
  TaskStatus,
  type QuestionBlockingLevel as QBL,
} from '../../domain/types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';

// ============================================
// Schema
// ============================================

export const RequestHumanInputSchema = z.object({
  task_id: z.string().uuid(),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  blocking_level: z.enum(['hard_block', 'soft_block', 'preference', 'fyi']),
  can_use_default: z.boolean().optional().default(false),
  default_value: z.string().optional(),
});

export type RequestHumanInputArgs = z.infer<typeof RequestHumanInputSchema>;

// ============================================
// Tool Definition
// ============================================

export const requestHumanInputTool: ToolDefinition = {
  name: 'request_human_input',
  description:
    'Requests input from a human operator. Use this when you need clarification, approval, or a decision that only a human can make.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        format: 'uuid',
        description: 'The ID of the task requesting input',
      },
      question: {
        type: 'string',
        description: 'The question to ask the human',
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of predefined answer options for multiple choice questions',
      },
      blocking_level: {
        type: 'string',
        enum: ['hard_block', 'soft_block', 'preference', 'fyi'],
        description:
          'How blocking is this question? hard_block: cannot proceed, soft_block: can proceed with caution, preference: nice to know, fyi: informational only',
      },
      can_use_default: {
        type: 'boolean',
        description: 'Whether a default value can be used if the question times out',
      },
      default_value: {
        type: 'string',
        description: 'Default value to use on timeout (only applies if can_use_default is true)',
      },
    },
    required: ['task_id', 'question', 'blocking_level'],
  },
};

// ============================================
// Result Type
// ============================================

export interface RequestHumanInputResult {
  question_id: string;
  task_id: string;
  blocking_level: string;
  task_blocked: boolean;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleRequestHumanInput(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<RequestHumanInputResult> {
  // Validate arguments
  const parseResult = RequestHumanInputSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { task_id, question, options, blocking_level, can_use_default, default_value } =
    parseResult.data;

  // Verify task exists
  const task = context.storage.getTask(task_id);
  if (!task) {
    return error(`Task not found: ${task_id}`);
  }

  // Verify task is in a valid state
  if (task.status !== 'running' && task.status !== 'auditing') {
    return error(
      `Cannot request human input for task in status '${task.status}'. Task must be 'running' or 'auditing'.`
    );
  }

  // Get agent_id from task
  const agentId = task.agent_id ?? 'unknown';

  // Update agent heartbeat
  if (context.healthMonitor) {
    context.healthMonitor.trackAgentHeartbeat(agentId);
  }

  // Create the question entity
  const questionEntity = createQuestion(
    task.run_id,
    agentId,
    question,
    blocking_level as QBL,
    {
      taskId: task_id,
      options,
      canUseDefault: can_use_default,
      defaultValue: default_value,
    }
  );

  context.storage.createQuestion(questionEntity);

  // Determine if task should be blocked
  const shouldBlock =
    blocking_level === QuestionBlockingLevel.HardBlock ||
    blocking_level === QuestionBlockingLevel.SoftBlock;

  let taskBlocked = false;
  if (shouldBlock) {
    const updatedTask = context.storage.updateTaskStatus(task_id, TaskStatus.Blocked);
    if (updatedTask) {
      taskBlocked = true;
    }
  }

  // Emit trajectory event for human input requested
  context.trajectoryCapture.capture(
    task.run_id,
    TrajectoryEventType.HumanInputRequested,
    {
      question_id: questionEntity.question_id,
      agent_id: agentId,
      text: question,
      blocking_level,
      options,
    },
    task_id
  );

  // Emit SSE event for question_added
  if (context.emitSSE) {
    context.emitSSE('question_added', {
      question_id: questionEntity.question_id,
      run_id: task.run_id,
      task_id,
      agent_id: agentId,
      text: question,
      options,
      blocking_level,
      can_use_default,
      default_value,
      priority_score: questionEntity.priority_score,
    });
  }

  const timestamp = new Date().toISOString();

  return success({
    question_id: questionEntity.question_id,
    task_id,
    blocking_level,
    task_blocked: taskBlocked,
    timestamp,
  });
}
