import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error, ArtifactInputSchema } from '../types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import { createArtifact, TaskStatus, type ArtifactType } from '../../domain/types.js';

// ============================================
// Schema
// ============================================

export const ReportCompleteSchema = z.object({
  task_id: z.string().uuid(),
  artifacts: z.array(ArtifactInputSchema).optional().default([]),
  notes: z.string().optional(),
});

export type ReportCompleteArgs = z.infer<typeof ReportCompleteSchema>;

// ============================================
// Tool Definition
// ============================================

export const reportCompleteTool: ToolDefinition = {
  name: 'report_complete',
  description:
    'Reports that a task has been completed successfully. Include any artifacts produced (commits, PRs, files, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        format: 'uuid',
        description: 'The ID of the completed task',
      },
      artifacts: {
        type: 'array',
        description: 'List of artifacts produced by the task',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['commit', 'pr', 'file', 'deployment', 'test_result'],
              description: 'Type of artifact',
            },
            reference: {
              type: 'string',
              description: 'Reference to the artifact (commit SHA, URL, path, etc.)',
            },
            metadata: {
              type: 'object',
              description: 'Optional additional metadata about the artifact',
            },
          },
          required: ['type', 'reference'],
        },
      },
      notes: {
        type: 'string',
        description: 'Optional completion notes or summary',
      },
    },
    required: ['task_id'],
  },
};

// ============================================
// Result Type
// ============================================

export interface ReportCompleteResult {
  task_id: string;
  new_status: string;
  artifacts_created: number;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleReportComplete(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<ReportCompleteResult> {
  // Validate arguments
  const parseResult = ReportCompleteSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { task_id, artifacts, notes } = parseResult.data;

  // Verify task exists
  const task = context.storage.getTask(task_id);
  if (!task) {
    return error(`Task not found: ${task_id}`);
  }

  // Verify task is in a state where completion can be reported
  if (task.status !== 'running') {
    return error(
      `Cannot report completion for task in status '${task.status}'. Task must be 'running'.`
    );
  }

  // Get agent_id from task
  const agentId = task.agent_id ?? 'unknown';

  // Create artifacts
  const createdArtifacts = artifacts.map((artifact) => {
    const created = createArtifact(
      task_id,
      artifact.type as ArtifactType,
      artifact.reference,
      artifact.metadata
    );
    context.storage.createArtifact(created);
    return created;
  });

  // Determine new status
  // If task has a gate_id, it needs approval before completion
  // Otherwise, check if this step requires auditing
  // For now, we'll transition to 'completed' unless gate exists
  // The audit flag would typically be checked from the original ForgePlan step
  // We'll use a heuristic: if task has a gate_id, go to awaiting_approval
  // Otherwise complete directly (audit handling is done via report_audit_result)
  let newStatus: TaskStatus;
  if (task.gate_id) {
    newStatus = TaskStatus.AwaitingApproval;
  } else {
    newStatus = TaskStatus.Completed;
  }

  // Update task status
  const updatedTask = context.storage.updateTaskStatus(task_id, newStatus);
  if (!updatedTask) {
    return error(`Failed to update task status: ${task_id}`);
  }

  // Update agent heartbeat
  if (context.healthMonitor) {
    context.healthMonitor.trackAgentHeartbeat(agentId);
  }

  // Get current attempt for event
  const attempts = context.storage.listAttemptsByTask(task_id);
  const currentAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  // Emit trajectory event
  context.trajectoryCapture.capture(
    task.run_id,
    TrajectoryEventType.TaskCompleted,
    {
      step_id: task.step_id,
      step_title: task.step_title,
      attempt_number: currentAttempt?.attempt_number ?? 1,
      artifacts_produced: createdArtifacts.length,
      notes,
    },
    task_id
  );

  const timestamp = new Date().toISOString();

  return success({
    task_id,
    new_status: newStatus,
    artifacts_created: createdArtifacts.length,
    timestamp,
  });
}
