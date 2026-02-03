import type { Request, Response } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import type { ForgePlan, Run, Task, TaskStatus } from '../../domain/types.js';
import { createRun, createTask, RunStatus, TaskStatus as TaskStatusEnum } from '../../domain/types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import {
  CreateRunRequestSchema,
  ListRunsQuerySchema,
  type RunResponse,
  type CreateRunResponse,
  type ListRunsResponse,
  type RunWithTasksResponse,
  type TaskSummary,
} from '../schemas.js';

// ============================================
// Types
// ============================================

/**
 * Function type for scheduling ready tasks after run creation.
 */
export type ScheduleReadyTasksFn = (runId: string) => void;

/**
 * Dependencies for run handlers.
 */
export interface RunHandlerDeps {
  storage: ForgeStorage;
  trajectoryCapture?: TrajectoryCapture;
  scheduleReadyTasks?: ScheduleReadyTasksFn;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Converts a Run entity to a RunResponse.
 */
function toRunResponse(run: Run, tasks: Task[]): RunResponse {
  const tasksCompleted = tasks.filter(
    (t) => t.status === TaskStatusEnum.Completed
  ).length;

  return {
    run_id: run.run_id,
    plan_id: run.plan_id,
    plan_version: run.plan_version,
    status: run.status,
    has_pending_gate: run.has_pending_gate,
    tasks_count: tasks.length,
    tasks_completed: tasksCompleted,
    started_at: run.started_at,
    completed_at: run.completed_at,
    error: run.error,
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}

/**
 * Converts a Task entity to a TaskSummary.
 */
function toTaskSummary(task: Task): TaskSummary {
  return {
    task_id: task.task_id,
    step_id: task.step_id,
    step_title: task.step_title,
    status: task.status,
    dependencies: task.dependencies,
    current_attempt: task.current_attempt,
    agent_id: task.agent_id,
    gate_id: task.gate_id,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for POST /runs
 *
 * Creates a new run from a ForgePlan, creates all tasks, and starts execution.
 */
export function createRunHandler(deps: RunHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      // Validate request body
      const bodyResult = CreateRunRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Get the plan - either inline or from reference
      let plan: ForgePlan;
      if (body.plan) {
        plan = body.plan;
      } else if (body.plan_id && body.plan_version) {
        // For now, we only support inline plans
        // In the future, this could fetch from Planner service
        res.status(400).json({
          error: 'Plan reference not yet supported. Please provide the full plan inline.',
          code: 'PLAN_REFERENCE_NOT_SUPPORTED',
        });
        return;
      } else {
        res.status(400).json({
          error: 'Either plan or plan_id+plan_version must be provided',
        });
        return;
      }

      // Create run and tasks in a transaction
      const { run, tasks } = deps.storage.transaction(() => {
        // Create the run
        const newRun = createRun(plan);
        const savedRun = deps.storage.createRun(newRun);

        // Create tasks from plan steps
        const createdTasks: Task[] = [];
        for (const step of plan.steps) {
          const task = createTask(savedRun.run_id, step);
          const savedTask = deps.storage.createTask(task);
          createdTasks.push(savedTask);
        }

        return { run: savedRun, tasks: createdTasks };
      });

      // Transition run to 'running' and emit trajectory event
      const updatedRun = deps.storage.updateRunStatus(run.run_id, RunStatus.Running);
      if (!updatedRun) {
        throw new Error('Failed to update run status');
      }

      // Emit run_started trajectory event
      if (deps.trajectoryCapture) {
        deps.trajectoryCapture.capture(run.run_id, TrajectoryEventType.RunStarted, {
          plan_id: plan.plan_id,
          plan_version: plan.version,
          goal: plan.summary.goal,
        });
      }

      // Schedule ready tasks (async - don't wait)
      if (deps.scheduleReadyTasks) {
        // Run asynchronously to not block the response
        setImmediate(() => {
          deps.scheduleReadyTasks?.(run.run_id);
        });
      }

      const response: CreateRunResponse = {
        run_id: run.run_id,
        status: updatedRun.status,
        tasks_count: tasks.length,
      };

      res.status(201).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[RunHandler] Error creating run:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /runs
 *
 * Lists runs with optional status filter and pagination.
 */
export function listRunsHandler(deps: RunHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      // Validate query parameters
      const queryResult = ListRunsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;

      // Get all runs (optionally filtered by status)
      const allRuns = deps.storage.listRuns(query.status);

      // Apply pagination
      const paginatedRuns = allRuns.slice(query.offset, query.offset + query.limit);

      // Get task counts for each run
      const runsWithCounts: RunResponse[] = paginatedRuns.map((run) => {
        const tasks = deps.storage.listTasksByRun(run.run_id);
        return toRunResponse(run, tasks);
      });

      const response: ListRunsResponse = {
        runs: runsWithCounts,
        total: allRuns.length,
        limit: query.limit,
        offset: query.offset,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[RunHandler] Error listing runs:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /runs/:id
 *
 * Returns full run details with all tasks.
 */
export function getRunHandler(deps: RunHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const runId = req.params.id;

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      // Get run
      const run = deps.storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: `Run not found: ${runId}` });
        return;
      }

      // Get all tasks for the run
      const tasks = deps.storage.listTasksByRun(runId);

      const response: RunWithTasksResponse = {
        ...toRunResponse(run, tasks),
        tasks: tasks.map(toTaskSummary),
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[RunHandler] Error getting run:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type CreateRunHandlerFn = ReturnType<typeof createRunHandler>;
export type ListRunsHandlerFn = ReturnType<typeof listRunsHandler>;
export type GetRunHandlerFn = ReturnType<typeof getRunHandler>;
