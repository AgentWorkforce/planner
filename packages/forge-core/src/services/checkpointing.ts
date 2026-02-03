import type { ForgeStorage } from '../storage/interface.js';
import type { Checkpoint, TaskSnapshot, Run, Task } from '../domain/types.js';
import { createCheckpoint, TaskStatus } from '../domain/types.js';

/**
 * Function type for getting the list of currently active agent IDs.
 * This is injected to decouple from specific agent management implementations.
 */
export type GetActiveAgentsFn = () => string[];

/**
 * Events that trigger checkpoint creation
 */
export type CheckpointTrigger =
  | 'task_completed'
  | 'task_failed'
  | 'gate_resolved'
  | 'run_paused'
  | 'run_resumed'
  | 'agent_spawned'
  | 'agent_released'
  | 'manual';

/**
 * CheckpointService handles creating durability checkpoints for run recovery.
 *
 * Checkpoints are created after significant state changes:
 * - Task completion
 * - Task failure
 * - Gate resolution (approved/rejected)
 * - Run pause/resume
 *
 * Checkpoint creation is non-blocking (fire and forget pattern) to avoid
 * impacting the critical path of task execution.
 */
export class CheckpointService {
  private pendingCheckpoints: Map<string, Promise<Checkpoint | null>> = new Map();

  constructor(
    private storage: ForgeStorage,
    private getActiveAgents: GetActiveAgentsFn
  ) {}

  /**
   * Creates a checkpoint for the given run.
   * This captures the current state of the run including all task statuses.
   *
   * @param runId - The ID of the run to checkpoint
   * @param trigger - What triggered this checkpoint (for logging/debugging)
   * @returns Promise that resolves to the created checkpoint, or null if run not found
   */
  async createCheckpoint(runId: string, trigger: CheckpointTrigger = 'manual'): Promise<Checkpoint | null> {
    // Check if there's already a pending checkpoint for this run
    const pending = this.pendingCheckpoints.get(runId);
    if (pending) {
      // Wait for the existing checkpoint to complete, then create a new one
      // This prevents duplicate checkpoints while ensuring we don't lose state
      await pending.catch(() => {}); // Ignore errors from previous checkpoint
    }

    const checkpointPromise = this.doCreateCheckpoint(runId, trigger);
    this.pendingCheckpoints.set(runId, checkpointPromise);

    try {
      const result = await checkpointPromise;
      return result;
    } finally {
      // Clean up after completion
      if (this.pendingCheckpoints.get(runId) === checkpointPromise) {
        this.pendingCheckpoints.delete(runId);
      }
    }
  }

  /**
   * Creates a checkpoint without blocking.
   * Use this for fire-and-forget checkpoint creation.
   *
   * @param runId - The ID of the run to checkpoint
   * @param trigger - What triggered this checkpoint
   */
  createCheckpointAsync(runId: string, trigger: CheckpointTrigger = 'manual'): void {
    this.createCheckpoint(runId, trigger).catch((error) => {
      console.error(`[CheckpointService] Failed to create checkpoint for run ${runId}:`, error);
    });
  }

  /**
   * Internal implementation of checkpoint creation.
   */
  private async doCreateCheckpoint(runId: string, trigger: CheckpointTrigger): Promise<Checkpoint | null> {
    // Get current run state
    const run = this.storage.getRun(runId);
    if (!run) {
      console.warn(`[CheckpointService] Run ${runId} not found, skipping checkpoint`);
      return null;
    }

    // Get all tasks for this run
    const tasks = this.storage.listTasksByRun(runId);

    // Build task snapshots
    const tasksSnapshot = this.buildTaskSnapshots(tasks);

    // Get currently active agents
    const activeAgents = this.getActiveAgents();

    // Create the checkpoint
    const checkpoint = createCheckpoint({
      runId,
      runStatus: run.status,
      hasPendingGate: run.has_pending_gate,
      tasksSnapshot,
      activeAgents,
      additionalData: {
        trigger,
        run_started_at: run.started_at,
        run_error: run.error,
      },
    });

    // Persist the checkpoint
    const saved = this.storage.createCheckpoint(checkpoint);

    console.log(
      `[CheckpointService] Created checkpoint ${saved.checkpoint_id} for run ${runId} ` +
      `(trigger: ${trigger}, tasks: ${tasksSnapshot.length}, agents: ${activeAgents.length})`
    );

    return saved;
  }

  /**
   * Builds task snapshots from the current task states.
   */
  private buildTaskSnapshots(tasks: Task[]): TaskSnapshot[] {
    return tasks.map((task) => ({
      task_id: task.task_id,
      step_id: task.step_id,
      status: task.status,
      current_attempt: task.current_attempt,
      agent_id: task.agent_id,
      gate_id: task.gate_id,
    }));
  }

  /**
   * Gets the latest checkpoint for a run.
   */
  getLatestCheckpoint(runId: string): Checkpoint | null {
    return this.storage.getLatestCheckpoint(runId);
  }

  /**
   * Lists all checkpoints for a run, ordered by creation time (newest first).
   */
  listCheckpoints(runId: string): Checkpoint[] {
    return this.storage.listCheckpoints(runId);
  }

  /**
   * Checks if there's a pending checkpoint being created for the given run.
   */
  hasPendingCheckpoint(runId: string): boolean {
    return this.pendingCheckpoints.has(runId);
  }

  /**
   * Waits for any pending checkpoint to complete.
   * Useful during shutdown to ensure all checkpoints are persisted.
   */
  async waitForPendingCheckpoints(): Promise<void> {
    const pending = Array.from(this.pendingCheckpoints.values());
    if (pending.length > 0) {
      console.log(`[CheckpointService] Waiting for ${pending.length} pending checkpoint(s)...`);
      await Promise.allSettled(pending);
    }
  }
}
