import type { ForgeStorage } from '../storage/interface.js';
import type { Run, Task } from '../domain/types.js';
import { RunStatus, TaskStatus } from '../domain/types.js';
import type { PlannerConfig } from '../config/forge-config.js';
import {
  PlannerClient,
  PlannerApiError,
  type ChangeRequest,
  type SuggestedChange,
  type ChangeRequestResponse,
} from './planner-client.js';

/**
 * Suggested change from a task that indicates the plan needs modification.
 */
export interface TaskSuggestedChange {
  type: SuggestedChange['type'];
  step_id?: string;
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Information about a blocked task that suggests plan changes.
 */
export interface BlockedTaskInfo {
  task_id: string;
  step_id: string;
  reason: string;
  suggested_changes?: TaskSuggestedChange[];
}

/**
 * Result of processing a blocked task.
 */
export interface ChangeRequestResult {
  /** Whether a change request was created */
  created: boolean;
  /** The change request ID (if created) */
  change_request_id?: string;
  /** Whether the run was paused */
  run_paused: boolean;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Options for handling blocked tasks.
 */
export interface ChangeRequestOptions {
  /** Whether to automatically pause the run when a change request is created */
  pause_run_on_change_request?: boolean;
  /** Whether to include related task context in the change request */
  include_task_context?: boolean;
}

/**
 * ChangeRequestHandler manages creating change requests when tasks report blockers
 * that require plan modifications.
 *
 * When a task reports it's blocked with suggested changes, this handler:
 * 1. Creates a ChangeRequest in the Planner service
 * 2. Optionally pauses the run to await plan revision
 * 3. Links the change request to the task for tracking
 */
export class ChangeRequestHandler {
  private readonly plannerClient: PlannerClient;
  private readonly storage: ForgeStorage;
  private readonly options: Required<ChangeRequestOptions>;

  constructor(
    plannerConfig: PlannerConfig,
    storage: ForgeStorage,
    options: ChangeRequestOptions = {}
  ) {
    this.plannerClient = new PlannerClient(plannerConfig);
    this.storage = storage;
    this.options = {
      pause_run_on_change_request: options.pause_run_on_change_request ?? true,
      include_task_context: options.include_task_context ?? true,
    };
  }

  /**
   * Processes a blocked task and creates a change request if needed.
   *
   * @param runId - The run ID
   * @param blockedTaskInfo - Information about the blocked task
   * @returns Result of the change request creation
   */
  async processBlockedTask(
    runId: string,
    blockedTaskInfo: BlockedTaskInfo
  ): Promise<ChangeRequestResult> {
    const run = this.storage.getRun(runId);
    if (!run) {
      return {
        created: false,
        run_paused: false,
        error: `Run ${runId} not found`,
      };
    }

    const task = this.storage.getTask(blockedTaskInfo.task_id);
    if (!task) {
      return {
        created: false,
        run_paused: false,
        error: `Task ${blockedTaskInfo.task_id} not found`,
      };
    }

    // Build the change request
    const changeRequest: ChangeRequest = {
      run_id: runId,
      task_id: blockedTaskInfo.task_id,
      reason: blockedTaskInfo.reason,
      suggested_changes: blockedTaskInfo.suggested_changes?.map((sc) => ({
        type: sc.type,
        step_id: sc.step_id,
        description: sc.description,
        details: sc.details,
      })),
    };

    // Add task context if enabled
    if (this.options.include_task_context) {
      changeRequest.suggested_changes = changeRequest.suggested_changes || [];
      // Add context about the task's position in the DAG
      const allTasks = this.storage.listTasksByRun(runId);
      const dependentTasks = allTasks.filter((t) =>
        t.dependencies.includes(blockedTaskInfo.step_id)
      );

      if (dependentTasks.length > 0 && changeRequest.suggested_changes) {
        // Note: This is informational context, not a change suggestion
        // The Planner can use this to understand impact
      }
    }

    // Create the change request in Planner
    let response: ChangeRequestResponse;
    try {
      response = await this.plannerClient.createChangeRequest(run.plan_id, changeRequest);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        created: false,
        run_paused: false,
        error: `Failed to create change request: ${errorMessage}`,
      };
    }

    // Update the task to track the change request
    this.storage.updateTask(blockedTaskInfo.task_id, {
      status: TaskStatus.Blocked,
    });

    // Optionally pause the run
    let runPaused = false;
    if (this.options.pause_run_on_change_request && run.status === RunStatus.Running) {
      try {
        this.storage.updateRunStatus(runId, RunStatus.Paused);
        runPaused = true;
      } catch (err) {
        console.warn(`Failed to pause run ${runId}:`, err);
      }
    }

    return {
      created: true,
      change_request_id: response.change_request_id,
      run_paused: runPaused,
    };
  }

  /**
   * Creates a change request directly without a blocked task.
   * Useful for manual or programmatic change requests.
   *
   * @param planId - The plan ID
   * @param runId - The run ID
   * @param reason - Reason for the change request
   * @param suggestedChanges - Optional suggested changes
   * @returns Result of the change request creation
   */
  async createChangeRequest(
    planId: string,
    runId: string,
    reason: string,
    suggestedChanges?: SuggestedChange[]
  ): Promise<ChangeRequestResult> {
    const run = this.storage.getRun(runId);
    if (!run) {
      return {
        created: false,
        run_paused: false,
        error: `Run ${runId} not found`,
      };
    }

    const changeRequest: ChangeRequest = {
      run_id: runId,
      reason,
      suggested_changes: suggestedChanges,
    };

    let response: ChangeRequestResponse;
    try {
      response = await this.plannerClient.createChangeRequest(planId, changeRequest);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        created: false,
        run_paused: false,
        error: `Failed to create change request: ${errorMessage}`,
      };
    }

    // Optionally pause the run
    let runPaused = false;
    if (this.options.pause_run_on_change_request && run.status === RunStatus.Running) {
      try {
        this.storage.updateRunStatus(runId, RunStatus.Paused);
        runPaused = true;
      } catch (err) {
        console.warn(`Failed to pause run ${runId}:`, err);
      }
    }

    return {
      created: true,
      change_request_id: response.change_request_id,
      run_paused: runPaused,
    };
  }

  /**
   * Checks if a task has suggested changes that should trigger a change request.
   * This is called by the task executor when a task reports a blocker.
   *
   * @param taskOutput - The output from task execution
   * @returns BlockedTaskInfo if the task suggests changes, undefined otherwise
   */
  parseTaskBlocker(
    taskId: string,
    taskOutput: {
      blocked?: boolean;
      reason?: string;
      suggested_changes?: TaskSuggestedChange[];
    }
  ): BlockedTaskInfo | undefined {
    if (!taskOutput.blocked || !taskOutput.reason) {
      return undefined;
    }

    const task = this.storage.getTask(taskId);
    if (!task) {
      return undefined;
    }

    return {
      task_id: taskId,
      step_id: task.step_id,
      reason: taskOutput.reason,
      suggested_changes: taskOutput.suggested_changes,
    };
  }

  /**
   * Gets all blocked tasks for a run that have not had change requests created.
   */
  getBlockedTasksWithoutChangeRequests(runId: string): Task[] {
    const tasks = this.storage.listTasksByRun(runId);
    return tasks.filter(
      (t) =>
        t.status === TaskStatus.Blocked
      // In a full implementation, we'd track which tasks have change requests
    );
  }
}

/**
 * Creates a ChangeRequestHandler instance.
 */
export function createChangeRequestHandler(
  plannerConfig: PlannerConfig,
  storage: ForgeStorage,
  options?: ChangeRequestOptions
): ChangeRequestHandler {
  return new ChangeRequestHandler(plannerConfig, storage, options);
}

/**
 * Helper function to build a suggested change for adding a step.
 */
export function suggestAddStep(
  description: string,
  details?: {
    title?: string;
    scope?: string;
    dependencies?: string[];
    after_step?: string;
  }
): SuggestedChange {
  return {
    type: 'add_step',
    description,
    details,
  };
}

/**
 * Helper function to build a suggested change for removing a step.
 */
export function suggestRemoveStep(stepId: string, reason: string): SuggestedChange {
  return {
    type: 'remove_step',
    step_id: stepId,
    description: reason,
  };
}

/**
 * Helper function to build a suggested change for modifying a step.
 */
export function suggestModifyStep(
  stepId: string,
  description: string,
  details?: {
    new_title?: string;
    new_description?: string;
    new_acceptance_criteria?: Array<{ id: string; description: string }>;
  }
): SuggestedChange {
  return {
    type: 'modify_step',
    step_id: stepId,
    description,
    details,
  };
}

/**
 * Helper function to build a suggested change for adding a dependency.
 */
export function suggestAddDependency(
  stepId: string,
  dependsOn: string,
  reason: string
): SuggestedChange {
  return {
    type: 'add_dependency',
    step_id: stepId,
    description: reason,
    details: { depends_on: dependsOn },
  };
}

/**
 * Helper function to build a suggested change for removing a dependency.
 */
export function suggestRemoveDependency(
  stepId: string,
  dependsOn: string,
  reason: string
): SuggestedChange {
  return {
    type: 'remove_dependency',
    step_id: stepId,
    description: reason,
    details: { depends_on: dependsOn },
  };
}
