import { z } from 'zod';
import type { ToolDefinition, ToolHandlerContext, ToolResponse } from '../types.js';
import { success, error, AuditFindingInputSchema } from '../types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import { TaskStatus, type AuditFinding } from '../../domain/types.js';

// ============================================
// Schema
// ============================================

export const ReportAuditResultSchema = z.object({
  task_id: z.string().uuid(),
  result: z.enum(['pass', 'fail']),
  findings: z.array(AuditFindingInputSchema).optional().default([]),
});

export type ReportAuditResultArgs = z.infer<typeof ReportAuditResultSchema>;

// ============================================
// Tool Definition
// ============================================

export const reportAuditResultTool: ToolDefinition = {
  name: 'report_audit_result',
  description:
    'Reports the result of an audit on a task. Used by auditor agents to verify acceptance criteria have been met.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        format: 'uuid',
        description: 'The ID of the task being audited',
      },
      result: {
        type: 'string',
        enum: ['pass', 'fail'],
        description: 'Overall audit result',
      },
      findings: {
        type: 'array',
        description: 'Detailed findings for each acceptance criterion',
        items: {
          type: 'object',
          properties: {
            criterion_id: {
              type: 'string',
              description: 'ID of the acceptance criterion being evaluated',
            },
            status: {
              type: 'string',
              enum: ['pass', 'fail'],
              description: 'Whether this criterion passed or failed',
            },
            details: {
              type: 'string',
              description: 'Explanation of the finding',
            },
          },
          required: ['criterion_id', 'status', 'details'],
        },
      },
    },
    required: ['task_id', 'result'],
  },
};

// ============================================
// Result Type
// ============================================

export interface ReportAuditResultResult {
  task_id: string;
  audit_result: 'pass' | 'fail';
  new_status: string;
  findings_count: number;
  timestamp: string;
}

// ============================================
// Handler
// ============================================

export function handleReportAuditResult(
  context: ToolHandlerContext,
  args: unknown
): ToolResponse<ReportAuditResultResult> {
  // Validate arguments
  const parseResult = ReportAuditResultSchema.safeParse(args);
  if (!parseResult.success) {
    return error(`Invalid arguments: ${parseResult.error.message}`);
  }

  const { task_id, result, findings } = parseResult.data;

  // Verify task exists
  const task = context.storage.getTask(task_id);
  if (!task) {
    return error(`Task not found: ${task_id}`);
  }

  // Verify task is in auditing state
  if (task.status !== 'auditing') {
    return error(
      `Cannot report audit result for task in status '${task.status}'. Task must be in 'auditing' status.`
    );
  }

  // Get agent_id from task
  const agentId = task.agent_id ?? 'unknown';

  // Update agent heartbeat
  if (context.healthMonitor) {
    context.healthMonitor.trackAgentHeartbeat(agentId);
  }

  // Get the current attempt and store audit findings
  const attempts = context.storage.listAttemptsByTask(task_id);
  const currentAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  if (currentAttempt) {
    // Store findings in the attempt
    const auditFindings: AuditFinding[] = findings.map((f) => ({
      criterion_id: f.criterion_id,
      status: f.status,
      details: f.details,
    }));

    context.storage.updateAttempt(currentAttempt.attempt_id, {
      audit_findings: auditFindings,
    });
  }

  // Determine new task status based on audit result
  let newStatus: TaskStatus;
  if (result === 'pass') {
    // Check if task has a gate that requires approval
    if (task.gate_id) {
      newStatus = TaskStatus.AwaitingApproval;
    } else {
      newStatus = TaskStatus.Completed;
    }
  } else {
    // Audit failed - task goes back to pending for retry
    newStatus = TaskStatus.Pending;
  }

  // Update task status
  const updatedTask = context.storage.updateTaskStatus(task_id, newStatus);
  if (!updatedTask) {
    return error(`Failed to update task status: ${task_id}`);
  }

  // Emit trajectory event for audit completed
  context.trajectoryCapture.capture(
    task.run_id,
    TrajectoryEventType.AuditCompleted,
    {
      step_id: task.step_id,
      step_title: task.step_title,
      passed: result === 'pass',
      findings: findings.map((f) => ({
        criterion_id: f.criterion_id,
        status: f.status,
        details: f.details,
      })),
    },
    task_id
  );

  const timestamp = new Date().toISOString();

  return success({
    task_id,
    audit_result: result,
    new_status: newStatus,
    findings_count: findings.length,
    timestamp,
  });
}
