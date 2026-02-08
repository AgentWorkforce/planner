import type { ForgeStorage } from '../storage/interface.js';
import type { ForgeStep, Task, Gate } from '../domain/types.js';
import { TaskStatus, GateStatus, createGate } from '../domain/types.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import { trackGateReached, trackGateApproved, trackGateRejected } from './tracked-transitions.js';

// ============================================
// Gate Service Types
// ============================================

/**
 * Result of processing a task for gate detection.
 */
export interface GateDetectionResult {
  /** Whether a gate was detected and created */
  hasGate: boolean;
  /** The gate entity if one was created */
  gate?: Gate;
  /** Whether the task should proceed with agent spawn (false if gate detected) */
  shouldSpawnAgent: boolean;
}

/**
 * Options for approving a gate.
 */
export interface GateApprovalOptions {
  /** Who approved the gate */
  decidedBy: string;
  /** Optional comment */
  comment?: string;
}

/**
 * Options for rejecting a gate.
 */
export interface GateRejectionOptions {
  /** Who rejected the gate */
  decidedBy: string;
  /** Reason for rejection (required) */
  reason: string;
  /** Optional additional comment */
  comment?: string;
}

/**
 * Result of a gate decision (approval or rejection).
 */
export interface GateDecisionResult {
  /** The updated gate entity */
  gate: Gate;
  /** The updated task entity */
  task: Task;
  /** Whether scheduling should resume (only for approval) */
  shouldResumeScheduling: boolean;
}

/**
 * Pending gate information for query results.
 */
export interface PendingGateInfo {
  gate_id: string;
  task_id: string;
  run_id: string;
  task_title: string;
  approver_role?: string;
  created_at: string;
}

/**
 * Callback for scheduling tasks after gate approval.
 */
export type ScheduleReadyTasksFn = (runId: string) => void;

// ============================================
// Gate Service
// ============================================

/**
 * GateService handles all gate-related operations:
 * - Gate detection during task processing
 * - Gate approval/rejection
 * - Scheduling pause/resume based on gate status
 */
export class GateService {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture;

  constructor(storage: ForgeStorage, trajectoryCapture: TrajectoryCapture) {
    this.storage = storage;
    this.trajectoryCapture = trajectoryCapture;
  }

  // ============================================
  // Gate Detection (fgh-s3)
  // ============================================

  /**
   * Detects if a task has a gate and handles gate creation.
   *
   * When processing a task from the queue:
   * - If forgeStep.gate exists: create Gate entity, set task status to 'awaiting_approval'
   * - If no gate: proceed with normal agent spawn
   *
   * @param task - The task being processed
   * @param forgeStep - The original step definition from the plan
   * @returns Detection result indicating whether to proceed with agent spawn
   */
  detectAndCreateGate(task: Task, forgeStep: ForgeStep): GateDetectionResult {
    // No gate configured
    if (!forgeStep.gate || forgeStep.gate.type !== 'human_approval') {
      return {
        hasGate: false,
        shouldSpawnAgent: true,
      };
    }

    // Create gate entity
    const gate = createGate(task.task_id, forgeStep.gate.approver_role);
    this.storage.createGate(gate);

    // Update task status to 'awaiting_approval' and link gate
    this.storage.updateTask(task.task_id, {
      status: TaskStatus.AwaitingApproval,
      gate_id: gate.gate_id,
    });

    // Set run.has_pending_gate = true to pause scheduling
    this.storage.updateRunGateFlag(task.run_id, true);

    // Get updated task for trajectory event
    const updatedTask = this.storage.getTask(task.task_id);
    if (updatedTask) {
      // Emit trajectory event 'gate_reached'
      trackGateReached(gate, updatedTask, this.trajectoryCapture);
    }

    return {
      hasGate: true,
      gate,
      shouldSpawnAgent: false,
    };
  }

  // ============================================
  // Gate Approval (fgh-s5)
  // ============================================

  /**
   * Approves a gate and resumes task execution.
   *
   * - Updates gate status to 'approved', records decided_by, decided_at, optional comment
   * - Updates task status to 'completed'
   * - Clears run.has_pending_gate=false
   * - Emits trajectory event 'gate_approved'
   *
   * @param taskId - The task ID (same as gate_id per spec: gate_id = task_id)
   * @param options - Approval options
   * @param scheduleReadyTasks - Optional callback to resume scheduling
   * @returns The gate decision result
   * @throws Error if gate not found or already decided
   */
  approveGate(
    taskId: string,
    options: GateApprovalOptions,
    scheduleReadyTasks?: ScheduleReadyTasksFn
  ): GateDecisionResult {
    // Get gate by task ID
    const gate = this.storage.getGateByTaskId(taskId);
    if (!gate) {
      throw new Error(`Gate not found for task: ${taskId}`);
    }

    // Verify gate is pending
    if (gate.status !== GateStatus.Pending) {
      throw new Error(`Gate already decided with status: ${gate.status}`);
    }

    // Get task
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Update gate decision
    const updatedGate = this.storage.updateGateDecision(
      gate.gate_id,
      GateStatus.Approved,
      options.decidedBy,
      options.comment
    );
    if (!updatedGate) {
      throw new Error(`Failed to update gate: ${gate.gate_id}`);
    }

    // Update task status to completed
    const updatedTask = this.storage.updateTaskStatus(taskId, TaskStatus.Completed);
    if (!updatedTask) {
      throw new Error(`Failed to update task status: ${taskId}`);
    }

    // Clear run's has_pending_gate flag
    this.storage.updateRunGateFlag(task.run_id, false);

    // Emit trajectory event
    trackGateApproved(updatedGate, updatedTask, this.trajectoryCapture);

    // Resume scheduling if callback provided
    if (scheduleReadyTasks) {
      scheduleReadyTasks(task.run_id);
    }

    return {
      gate: updatedGate,
      task: updatedTask,
      shouldResumeScheduling: true,
    };
  }

  // ============================================
  // Gate Rejection (fgh-s6)
  // ============================================

  /**
   * Rejects a gate and fails the task.
   *
   * - Updates gate status to 'rejected', records decided_by, decided_at, required reason
   * - Updates task status to 'failed' with rejection reason
   * - Emits trajectory event 'gate_rejected'
   *
   * @param taskId - The task ID (same as gate_id per spec)
   * @param options - Rejection options (reason is required)
   * @returns The gate decision result
   * @throws Error if gate not found or already decided
   */
  rejectGate(taskId: string, options: GateRejectionOptions): GateDecisionResult {
    // Get gate by task ID
    const gate = this.storage.getGateByTaskId(taskId);
    if (!gate) {
      throw new Error(`Gate not found for task: ${taskId}`);
    }

    // Verify gate is pending
    if (gate.status !== GateStatus.Pending) {
      throw new Error(`Gate already decided with status: ${gate.status}`);
    }

    // Get task
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Combine reason and comment for gate comment field
    const fullComment = options.comment
      ? `${options.reason}\n\n${options.comment}`
      : options.reason;

    // Update gate decision
    const updatedGate = this.storage.updateGateDecision(
      gate.gate_id,
      GateStatus.Rejected,
      options.decidedBy,
      fullComment
    );
    if (!updatedGate) {
      throw new Error(`Failed to update gate: ${gate.gate_id}`);
    }

    // Update task status to failed
    const updatedTask = this.storage.updateTaskStatus(taskId, TaskStatus.Failed);
    if (!updatedTask) {
      throw new Error(`Failed to update task status: ${taskId}`);
    }

    // Emit trajectory event
    trackGateRejected(updatedGate, updatedTask, this.trajectoryCapture, options.reason);

    return {
      gate: updatedGate,
      task: updatedTask,
      shouldResumeScheduling: false,
    };
  }

  // ============================================
  // Pending Gates Query (fgh-s7)
  // ============================================

  /**
   * Lists all pending gates, optionally filtered by run ID.
   *
   * Returns gates sorted by created_at (oldest first).
   *
   * @param runId - Optional run ID to filter by
   * @returns Array of pending gate information
   */
  listPendingGates(runId?: string): PendingGateInfo[] {
    // If run ID provided, use existing method
    if (runId) {
      return this.listPendingGatesForRun(runId);
    }

    // Otherwise, list pending gates across all runs
    // We need to get all runs and collect their pending gates
    const allRuns = this.storage.listRuns();
    const allPendingGates: PendingGateInfo[] = [];

    for (const run of allRuns) {
      const pendingForRun = this.listPendingGatesForRun(run.run_id);
      allPendingGates.push(...pendingForRun);
    }

    // Sort by created_at (oldest first)
    allPendingGates.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return allPendingGates;
  }

  /**
   * Lists pending gates for a specific run.
   */
  private listPendingGatesForRun(runId: string): PendingGateInfo[] {
    const gates = this.storage.listPendingGates(runId);
    const pendingGates: PendingGateInfo[] = [];

    for (const gate of gates) {
      const task = this.storage.getTask(gate.task_id);
      if (task) {
        pendingGates.push({
          gate_id: gate.gate_id,
          task_id: gate.task_id,
          run_id: task.run_id,
          task_title: task.step_title,
          approver_role: gate.approver_role,
          created_at: gate.created_at,
        });
      }
    }

    return pendingGates;
  }

  // ============================================
  // Scheduling Check (fgh-s4)
  // ============================================

  /**
   * Checks if a run has a pending gate that should block scheduling.
   *
   * Used by TaskScheduler.scheduleReadyTasks to determine if new tasks
   * should be enqueued.
   *
   * @param runId - The run ID to check
   * @returns true if scheduling should be blocked
   */
  shouldBlockScheduling(runId: string): boolean {
    const run = this.storage.getRun(runId);
    return run?.has_pending_gate ?? false;
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a new GateService instance.
 */
export function createGateService(
  storage: ForgeStorage,
  trajectoryCapture: TrajectoryCapture
): GateService {
  return new GateService(storage, trajectoryCapture);
}
