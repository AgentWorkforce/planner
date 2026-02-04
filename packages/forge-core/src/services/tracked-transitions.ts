import type { Run, Task, Gate, Question, RunStatus, TaskStatus, GateStatus } from '../domain/types.js';
import { transitionRun, transitionTask } from '../domain/types.js';
import { TrajectoryEventType } from '../domain/trajectory-events.js';
import type { TrajectoryCapture } from './trajectory-capture.js';

// ============================================
// Run Transition Tracking
// ============================================

/**
 * Maps run status to the corresponding trajectory event type.
 */
function runStatusToEventType(status: RunStatus): TrajectoryEventType {
  switch (status) {
    case 'running':
      return TrajectoryEventType.RunStarted;
    case 'completed':
      return TrajectoryEventType.RunCompleted;
    case 'failed':
      return TrajectoryEventType.RunFailed;
    case 'paused':
      return TrajectoryEventType.RunPaused;
    case 'cancelled':
      return TrajectoryEventType.RunCancelled;
    default:
      // For 'pending' or any other status, we don't have a specific event
      return TrajectoryEventType.RunStarted;
  }
}

/**
 * Transitions a Run to a new status and emits a trajectory event.
 *
 * @param run - The run to transition
 * @param newStatus - The new status
 * @param trajectoryCapture - TrajectoryCapture service for event emission
 * @param payload - Additional payload data for the trajectory event
 * @returns The updated Run
 */
export function trackedTransitionRun(
  run: Run,
  newStatus: RunStatus,
  trajectoryCapture: TrajectoryCapture,
  payload?: Record<string, unknown>
): Run {
  const previousStatus = run.status;
  const updated = transitionRun(run, newStatus);

  // Determine event type based on new status
  let eventType = runStatusToEventType(newStatus);

  // Special case: if we're going from paused to running, it's a resume
  if (previousStatus === 'paused' && newStatus === 'running') {
    eventType = TrajectoryEventType.RunResumed;
  }

  // Build event payload
  const eventPayload: Record<string, unknown> = {
    previous_status: previousStatus,
    ...payload,
  };

  // Add status-specific fields
  switch (newStatus) {
    case 'running':
      if (previousStatus === 'pending') {
        eventPayload.plan_id = run.plan_id;
        eventPayload.plan_version = run.plan_version;
      }
      break;
    case 'completed':
      if (run.started_at && updated.completed_at) {
        const startTime = new Date(run.started_at).getTime();
        const endTime = new Date(updated.completed_at).getTime();
        eventPayload.duration_ms = endTime - startTime;
      }
      break;
    case 'failed':
      if (updated.error) {
        eventPayload.error = updated.error;
      }
      if (run.started_at && updated.completed_at) {
        const startTime = new Date(run.started_at).getTime();
        const endTime = new Date(updated.completed_at).getTime();
        eventPayload.duration_ms = endTime - startTime;
      }
      break;
  }

  trajectoryCapture.capture(run.run_id, eventType, eventPayload);

  return updated;
}

// ============================================
// Task Transition Tracking
// ============================================

/**
 * Maps task status to the corresponding trajectory event type.
 */
function taskStatusToEventType(status: TaskStatus): TrajectoryEventType | null {
  switch (status) {
    case 'queued':
      return TrajectoryEventType.TaskQueued;
    case 'running':
      return TrajectoryEventType.TaskStarted;
    case 'completed':
      return TrajectoryEventType.TaskCompleted;
    case 'failed':
      return TrajectoryEventType.TaskFailed;
    case 'blocked':
      return TrajectoryEventType.TaskBlocked;
    case 'auditing':
      return TrajectoryEventType.AuditStarted;
    default:
      // For 'pending', 'awaiting_approval' we handle separately
      return null;
  }
}

/**
 * Transitions a Task to a new status and emits a trajectory event.
 *
 * @param task - The task to transition
 * @param newStatus - The new status
 * @param trajectoryCapture - TrajectoryCapture service for event emission
 * @param payload - Additional payload data for the trajectory event
 * @returns The updated Task
 */
export function trackedTransitionTask(
  task: Task,
  newStatus: TaskStatus,
  trajectoryCapture: TrajectoryCapture,
  payload?: Record<string, unknown>
): Task {
  const previousStatus = task.status;
  const updated = transitionTask(task, newStatus);

  // Determine event type
  let eventType = taskStatusToEventType(newStatus);

  // Special case: if going from failed back to pending, it's a retry
  if (previousStatus === 'failed' && newStatus === 'pending') {
    eventType = TrajectoryEventType.TaskRetrying;
  }

  // Skip emitting if no event type (e.g., pending -> pending)
  if (!eventType) {
    return updated;
  }

  // Build event payload
  const eventPayload: Record<string, unknown> = {
    step_id: task.step_id,
    step_title: task.step_title,
    previous_status: previousStatus,
    ...payload,
  };

  // Add status-specific fields
  switch (newStatus) {
    case 'running':
      if (task.current_attempt !== undefined) {
        eventPayload.attempt_number = task.current_attempt;
      }
      if (task.agent_id) {
        eventPayload.agent_id = task.agent_id;
      }
      if (task.workspace_path) {
        eventPayload.workspace_path = task.workspace_path;
      }
      break;
    case 'completed':
      if (task.current_attempt !== undefined) {
        eventPayload.attempt_number = task.current_attempt;
      }
      break;
    case 'failed':
      if (task.current_attempt !== undefined) {
        eventPayload.attempt_number = task.current_attempt;
      }
      break;
    case 'blocked':
      eventPayload.blocked_by = task.dependencies;
      break;
  }

  trajectoryCapture.capture(task.run_id, eventType, eventPayload, task.task_id);

  return updated;
}

// ============================================
// Gate Event Tracking
// ============================================

/**
 * Emits a trajectory event when a gate is reached.
 *
 * @param gate - The gate that was reached
 * @param task - The task associated with the gate
 * @param trajectoryCapture - TrajectoryCapture service
 */
export function trackGateReached(
  gate: Gate,
  task: Task,
  trajectoryCapture: TrajectoryCapture
): void {
  const payload: Record<string, unknown> = {
    gate_id: gate.gate_id,
    step_id: task.step_id,
    step_title: task.step_title,
  };

  if (gate.approver_role) {
    payload.approver_role = gate.approver_role;
  }

  trajectoryCapture.capture(task.run_id, TrajectoryEventType.GateReached, payload, task.task_id);
}

/**
 * Emits a trajectory event when a gate is approved.
 *
 * @param gate - The approved gate
 * @param task - The task associated with the gate
 * @param trajectoryCapture - TrajectoryCapture service
 */
export function trackGateApproved(
  gate: Gate,
  task: Task,
  trajectoryCapture: TrajectoryCapture
): void {
  const payload: Record<string, unknown> = {
    gate_id: gate.gate_id,
    step_id: task.step_id,
    step_title: task.step_title,
  };

  if (gate.decided_by) {
    payload.approved_by = gate.decided_by;
  }
  if (gate.comment) {
    payload.comment = gate.comment;
  }

  trajectoryCapture.capture(task.run_id, TrajectoryEventType.GateApproved, payload, task.task_id);
}

/**
 * Emits a trajectory event when a gate is rejected.
 *
 * @param gate - The rejected gate
 * @param task - The task associated with the gate
 * @param trajectoryCapture - TrajectoryCapture service
 * @param reason - Optional reason for rejection
 */
export function trackGateRejected(
  gate: Gate,
  task: Task,
  trajectoryCapture: TrajectoryCapture,
  reason?: string
): void {
  const payload: Record<string, unknown> = {
    gate_id: gate.gate_id,
    step_id: task.step_id,
    step_title: task.step_title,
  };

  if (gate.decided_by) {
    payload.rejected_by = gate.decided_by;
  }
  if (gate.comment) {
    payload.comment = gate.comment;
  }
  if (reason) {
    payload.reason = reason;
  }

  trajectoryCapture.capture(task.run_id, TrajectoryEventType.GateRejected, payload, task.task_id);
}

// ============================================
// Question Event Tracking
// ============================================

/**
 * Emits a trajectory event when a question is asked (human input requested).
 *
 * @param question - The question being asked
 * @param trajectoryCapture - TrajectoryCapture service
 */
export function trackQuestionAsked(
  question: Question,
  trajectoryCapture: TrajectoryCapture
): void {
  const payload: Record<string, unknown> = {
    question_id: question.question_id,
    agent_id: question.agent_id,
    text: question.text,
    blocking_level: question.blocking_level,
  };

  if (question.options && question.options.length > 0) {
    payload.options = question.options;
  }

  trajectoryCapture.capture(
    question.run_id,
    TrajectoryEventType.HumanInputRequested,
    payload,
    question.task_id
  );
}

/**
 * Emits a trajectory event when a question is answered.
 *
 * @param question - The answered question
 * @param trajectoryCapture - TrajectoryCapture service
 * @param answeredBy - Optional identifier of who answered
 * @param waitDurationMs - Optional duration waiting for answer
 */
export function trackQuestionAnswered(
  question: Question,
  trajectoryCapture: TrajectoryCapture,
  answeredBy?: string,
  waitDurationMs?: number
): void {
  const payload: Record<string, unknown> = {
    question_id: question.question_id,
    agent_id: question.agent_id,
    answer: question.answer ?? '',
  };

  if (answeredBy) {
    payload.answered_by = answeredBy;
  }
  if (waitDurationMs !== undefined) {
    payload.wait_duration_ms = waitDurationMs;
  }

  trajectoryCapture.capture(
    question.run_id,
    TrajectoryEventType.QuestionAnswered,
    payload,
    question.task_id
  );
}

/**
 * Emits a trajectory event when a question is dismissed.
 *
 * @param question - The dismissed question
 * @param trajectoryCapture - TrajectoryCapture service
 * @param dismissedBy - Optional identifier of who dismissed
 * @param reason - Optional reason for dismissal
 */
export function trackQuestionDismissed(
  question: Question,
  trajectoryCapture: TrajectoryCapture,
  dismissedBy?: string,
  reason?: string
): void {
  const payload: Record<string, unknown> = {
    question_id: question.question_id,
    agent_id: question.agent_id,
  };

  if (dismissedBy) {
    payload.dismissed_by = dismissedBy;
  }
  if (reason) {
    payload.reason = reason;
  }

  trajectoryCapture.capture(
    question.run_id,
    TrajectoryEventType.QuestionDismissed,
    payload,
    question.task_id
  );
}

// ============================================
// Agent Event Tracking
// ============================================

/**
 * Emits a trajectory event when an agent is spawned.
 *
 * @param runId - The run ID
 * @param taskId - The task ID the agent is working on
 * @param agentId - The agent ID
 * @param trajectoryCapture - TrajectoryCapture service
 * @param options - Additional spawn options
 */
export function trackAgentSpawned(
  runId: string,
  taskId: string,
  agentId: string,
  trajectoryCapture: TrajectoryCapture,
  options?: {
    cli?: string;
    workspacePath?: string;
    stepId?: string;
  }
): void {
  const payload: Record<string, unknown> = {
    agent_id: agentId,
  };

  if (options?.cli) {
    payload.cli = options.cli;
  }
  if (options?.workspacePath) {
    payload.workspace_path = options.workspacePath;
  }
  if (options?.stepId) {
    payload.step_id = options.stepId;
  }

  trajectoryCapture.capture(runId, TrajectoryEventType.AgentSpawned, payload, taskId);
}

/**
 * Emits a trajectory event when an agent exits.
 *
 * @param runId - The run ID
 * @param taskId - The task ID the agent was working on
 * @param agentId - The agent ID
 * @param trajectoryCapture - TrajectoryCapture service
 * @param options - Exit details
 */
export function trackAgentExited(
  runId: string,
  taskId: string,
  agentId: string,
  trajectoryCapture: TrajectoryCapture,
  options?: {
    exitCode?: number;
    reason?: string;
    durationMs?: number;
  }
): void {
  const payload: Record<string, unknown> = {
    agent_id: agentId,
  };

  if (options?.exitCode !== undefined) {
    payload.exit_code = options.exitCode;
  }
  if (options?.reason) {
    payload.reason = options.reason;
  }
  if (options?.durationMs !== undefined) {
    payload.duration_ms = options.durationMs;
  }

  trajectoryCapture.capture(runId, TrajectoryEventType.AgentExited, payload, taskId);
}

// ============================================
// Checkpoint Event Tracking
// ============================================

/**
 * Emits a trajectory event when a checkpoint is created.
 *
 * @param runId - The run ID
 * @param checkpointId - The checkpoint ID
 * @param trajectoryCapture - TrajectoryCapture service
 * @param stats - Optional checkpoint statistics
 */
export function trackCheckpointCreated(
  runId: string,
  checkpointId: string,
  trajectoryCapture: TrajectoryCapture,
  stats?: {
    taskCount?: number;
    completedCount?: number;
    snapshotSizeBytes?: number;
  }
): void {
  const payload: Record<string, unknown> = {
    checkpoint_id: checkpointId,
  };

  if (stats?.taskCount !== undefined) {
    payload.task_count = stats.taskCount;
  }
  if (stats?.completedCount !== undefined) {
    payload.completed_count = stats.completedCount;
  }
  if (stats?.snapshotSizeBytes !== undefined) {
    payload.snapshot_size_bytes = stats.snapshotSizeBytes;
  }

  trajectoryCapture.capture(runId, TrajectoryEventType.CheckpointCreated, payload);
}
