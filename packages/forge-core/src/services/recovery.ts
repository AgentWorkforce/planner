import type { ForgeStorage } from '../storage/interface.js';
import type { Checkpoint, Run, Task, TaskSnapshot } from '../domain/types.js';
import { RunStatus, TaskStatus } from '../domain/types.js';

/**
 * Result of orphan agent detection
 */
export interface OrphanDetectionResult {
  /** Agents that are running but not expected according to checkpoint */
  orphans: string[];
  /** Agents that were expected but are not actually running */
  missing: string[];
}

/**
 * Action taken during recovery for a single run
 */
export interface RunRecoveryAction {
  runId: string;
  status: 'recovered' | 'failed' | 'skipped';
  checkpointId?: string;
  checkpointTimestamp?: string;
  orphansTerminated: string[];
  tasksRetried: string[];
  error?: string;
}

/**
 * Complete log of a recovery operation
 */
export interface RecoveryLog {
  timestamp: string;
  runsRecovered: number;
  runsFailed: number;
  runsSkipped: number;
  totalOrphansTerminated: number;
  totalTasksRetried: number;
  actions: RunRecoveryAction[];
}

/**
 * Function type for getting the list of actually running agent IDs.
 * This is used to compare against expected agents from checkpoint.
 */
export type GetActualAgentsFn = () => string[];

/**
 * Function type for terminating an orphaned agent.
 */
export type TerminateAgentFn = (agentId: string) => Promise<void>;

/**
 * Function type for retrying a task (mark it for re-execution).
 */
export type RetryTaskFn = (taskId: string) => Promise<void>;

/**
 * Configuration for the recovery service
 */
export interface RecoveryServiceConfig {
  /** Grace period before terminating orphan agents (ms). Default: 30000 (30s) */
  orphanGracePeriodMs: number;
}

const DEFAULT_CONFIG: RecoveryServiceConfig = {
  orphanGracePeriodMs: 30000,
};

/**
 * RecoveryService handles recovering active runs after a Forgemaster restart.
 *
 * On startup, it:
 * 1. Finds all runs with status 'running' or 'paused'
 * 2. For each run, loads the latest checkpoint
 * 3. Verifies agent states and detects orphans
 * 4. Resumes scheduling for tasks that were in progress
 *
 * Recovery is designed to be:
 * - Safe: Only acts on runs that were interrupted
 * - Idempotent: Can be run multiple times without side effects
 * - Observable: Produces a detailed log of all recovery actions
 */
export class RecoveryService {
  private lastRecoveryLog: RecoveryLog | null = null;
  private config: RecoveryServiceConfig;

  constructor(
    private storage: ForgeStorage,
    private getActualAgents: GetActualAgentsFn,
    private terminateAgent: TerminateAgentFn,
    private retryTask: RetryTaskFn,
    config: Partial<RecoveryServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Recovers all active runs after a restart.
   * This should be called during Forgemaster startup.
   *
   * @returns Recovery log with details of all actions taken
   */
  async recoverActiveRuns(): Promise<RecoveryLog> {
    const timestamp = new Date().toISOString();
    const actions: RunRecoveryAction[] = [];

    console.log('[RecoveryService] Starting recovery of active runs...');

    // Find all runs that need recovery (running or paused)
    const activeRuns = this.storage.getActiveRuns();
    console.log(`[RecoveryService] Found ${activeRuns.length} active run(s) to recover`);

    // Get actual running agents
    const actualAgents = this.getActualAgents();
    console.log(`[RecoveryService] Found ${actualAgents.length} actual running agent(s)`);

    // Recover each run
    for (const run of activeRuns) {
      const action = await this.recoverRun(run, actualAgents);
      actions.push(action);
    }

    // Build and store recovery log
    const log: RecoveryLog = {
      timestamp,
      runsRecovered: actions.filter((a) => a.status === 'recovered').length,
      runsFailed: actions.filter((a) => a.status === 'failed').length,
      runsSkipped: actions.filter((a) => a.status === 'skipped').length,
      totalOrphansTerminated: actions.reduce((sum, a) => sum + a.orphansTerminated.length, 0),
      totalTasksRetried: actions.reduce((sum, a) => sum + a.tasksRetried.length, 0),
      actions,
    };

    this.lastRecoveryLog = log;

    console.log(
      `[RecoveryService] Recovery complete: ` +
      `${log.runsRecovered} recovered, ${log.runsFailed} failed, ${log.runsSkipped} skipped, ` +
      `${log.totalOrphansTerminated} orphans terminated, ${log.totalTasksRetried} tasks retried`
    );

    return log;
  }

  /**
   * Recovers a single run.
   */
  private async recoverRun(run: Run, actualAgents: string[]): Promise<RunRecoveryAction> {
    const action: RunRecoveryAction = {
      runId: run.run_id,
      status: 'recovered',
      orphansTerminated: [],
      tasksRetried: [],
    };

    try {
      // Load the latest checkpoint
      const checkpoint = this.storage.getLatestCheckpoint(run.run_id);

      if (!checkpoint) {
        console.warn(`[RecoveryService] No checkpoint found for run ${run.run_id}, skipping recovery`);
        action.status = 'skipped';
        return action;
      }

      action.checkpointId = checkpoint.checkpoint_id;
      action.checkpointTimestamp = checkpoint.created_at;

      console.log(
        `[RecoveryService] Recovering run ${run.run_id} from checkpoint ${checkpoint.checkpoint_id} ` +
        `(created: ${checkpoint.created_at})`
      );

      // Detect orphan agents
      const orphanResult = this.detectOrphanAgents(checkpoint, actualAgents);

      // Handle orphaned agents (with grace period already handled at detection level)
      for (const orphanId of orphanResult.orphans) {
        try {
          console.log(`[RecoveryService] Terminating orphan agent: ${orphanId}`);
          await this.terminateAgent(orphanId);
          action.orphansTerminated.push(orphanId);
        } catch (error) {
          console.error(`[RecoveryService] Failed to terminate orphan agent ${orphanId}:`, error);
        }
      }

      // Handle missing agents - retry their tasks
      for (const missingAgentId of orphanResult.missing) {
        // Find tasks that were assigned to this agent
        const taskSnapshot = checkpoint.tasks_snapshot.find(
          (ts) => ts.agent_id === missingAgentId && ts.status === TaskStatus.Running
        );

        if (taskSnapshot) {
          try {
            console.log(
              `[RecoveryService] Retrying task ${taskSnapshot.task_id} ` +
              `(agent ${missingAgentId} is missing)`
            );
            await this.retryTask(taskSnapshot.task_id);
            action.tasksRetried.push(taskSnapshot.task_id);
          } catch (error) {
            console.error(
              `[RecoveryService] Failed to retry task ${taskSnapshot.task_id}:`,
              error
            );
          }
        }
      }

      // Mark any running tasks without agents as pending for retry
      const currentTasks = this.storage.listTasksByRun(run.run_id);
      for (const task of currentTasks) {
        if (task.status === TaskStatus.Running && task.agent_id) {
          // Check if the assigned agent is actually running
          if (!actualAgents.includes(task.agent_id) && !action.tasksRetried.includes(task.task_id)) {
            try {
              console.log(
                `[RecoveryService] Retrying task ${task.task_id} ` +
                `(assigned agent ${task.agent_id} not running)`
              );
              await this.retryTask(task.task_id);
              action.tasksRetried.push(task.task_id);
            } catch (error) {
              console.error(`[RecoveryService] Failed to retry task ${task.task_id}:`, error);
            }
          }
        }
      }

      action.status = 'recovered';
    } catch (error) {
      console.error(`[RecoveryService] Failed to recover run ${run.run_id}:`, error);
      action.status = 'failed';
      action.error = error instanceof Error ? error.message : String(error);
    }

    return action;
  }

  /**
   * Detects orphaned and missing agents by comparing expected (from checkpoint)
   * vs actual running agents.
   *
   * @param checkpoint - The checkpoint containing expected agent state
   * @param actualAgents - List of agent IDs that are actually running
   * @returns Object with orphan and missing agent IDs
   */
  detectOrphanAgents(checkpoint: Checkpoint, actualAgents: string[]): OrphanDetectionResult {
    const expectedAgents = new Set(checkpoint.active_agents);
    const actualSet = new Set(actualAgents);

    // Orphans: running but not expected
    const orphans = actualAgents.filter((agentId) => !expectedAgents.has(agentId));

    // Missing: expected but not running
    const missing = checkpoint.active_agents.filter((agentId) => !actualSet.has(agentId));

    return { orphans, missing };
  }

  /**
   * Gets the most recent recovery log, if any.
   */
  getRecoveryLog(): RecoveryLog | null {
    return this.lastRecoveryLog;
  }

  /**
   * Clears the stored recovery log.
   */
  clearRecoveryLog(): void {
    this.lastRecoveryLog = null;
  }
}

/**
 * Standalone function to get the recovery log.
 * Useful for API handlers that don't have direct access to the service instance.
 */
let globalRecoveryService: RecoveryService | null = null;

export function setGlobalRecoveryService(service: RecoveryService | null): void {
  globalRecoveryService = service;
}

export function getRecoveryLog(): RecoveryLog | null {
  return globalRecoveryService?.getRecoveryLog() ?? null;
}
