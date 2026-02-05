import type { Request, Response } from 'express';
import type { ForgeStorage, TrajectoryEventFilter } from '../../storage/interface.js';
import type { Task, TaskAttempt, Artifact } from '../../domain/types.js';
import type {
  TaskDetailResponse,
  TaskSummary,
  AttemptDetail,
  ArtifactDetail,
} from '../schemas.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import type { LinkedRetrospective, RetrospectiveResult } from '../../domain/retrospective.js';

// ============================================
// Types
// ============================================

/**
 * Dependencies for task handlers.
 */
export interface TaskHandlerDeps {
  storage: ForgeStorage;
}

// ============================================
// Helper Functions
// ============================================

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

/**
 * Converts a TaskAttempt entity to an AttemptDetail.
 */
function toAttemptDetail(attempt: TaskAttempt): AttemptDetail {
  return {
    attempt_id: attempt.attempt_id,
    attempt_number: attempt.attempt_number,
    started_at: attempt.started_at,
    ended_at: attempt.ended_at,
    outcome: attempt.outcome,
    error: attempt.error,
    agent_id: attempt.agent_id,
  };
}

/**
 * Converts an Artifact entity to an ArtifactDetail.
 */
function toArtifactDetail(artifact: Artifact): ArtifactDetail {
  return {
    artifact_id: artifact.artifact_id,
    type: artifact.type,
    reference: artifact.reference,
    metadata: artifact.metadata,
    created_at: artifact.created_at,
  };
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for GET /runs/:id/tasks/:taskId
 *
 * Returns full task details including attempts and artifacts.
 */
export function getTaskDetailHandler(deps: TaskHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const { id: runId, taskId } = req.params as { id: string; taskId: string };

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }

      // Verify run exists
      const run = deps.storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: `Run not found: ${runId}` });
        return;
      }

      // Get task
      const task = deps.storage.getTask(taskId);
      if (!task) {
        res.status(404).json({ error: `Task not found: ${taskId}` });
        return;
      }

      // Verify task belongs to this run
      if (task.run_id !== runId) {
        res.status(404).json({
          error: `Task ${taskId} does not belong to run ${runId}`,
        });
        return;
      }

      // Get attempts for this task
      const attempts = deps.storage.listAttemptsByTask(taskId);

      // Get artifacts for this task
      const artifacts = deps.storage.listArtifactsByTask(taskId);

      const response: TaskDetailResponse = {
        task: toTaskSummary(task),
        attempts: attempts.map(toAttemptDetail),
        artifacts: artifacts.map(toArtifactDetail),
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[TaskHandler] Error getting task details:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /runs/:id/tasks/:taskId/retrospective
 *
 * Returns the retrospective for a completed task if available.
 */
export function getTaskRetrospectiveHandler(deps: TaskHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const { id: runId, taskId } = req.params as { id: string; taskId: string };

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }

      // Verify run exists
      const run = deps.storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: `Run not found: ${runId}` });
        return;
      }

      // Get task
      const task = deps.storage.getTask(taskId);
      if (!task) {
        res.status(404).json({ error: `Task not found: ${taskId}` });
        return;
      }

      // Verify task belongs to this run
      if (task.run_id !== runId) {
        res.status(404).json({
          error: `Task ${taskId} does not belong to run ${runId}`,
        });
        return;
      }

      // Look for retrospective events for this task
      const filter: TrajectoryEventFilter = {
        task_id: taskId,
      };
      const allEvents = deps.storage.listTrajectoryEvents(runId, filter);

      // Check for each type of retrospective event in order of preference
      for (const event of allEvents) {
        if (event.event_type === TrajectoryEventType.RetrospectiveRecorded) {
          const payload = event.payload as {
            task_id: string;
            agent_id: string;
            retrospective: LinkedRetrospective;
          };
          const result: RetrospectiveResult = {
            status: 'success',
            retrospective: payload.retrospective,
            event_id: event.event_id,
          };
          res.status(200).json(result);
          return;
        }

        if (event.event_type === TrajectoryEventType.RetrospectiveTimeout) {
          const payload = event.payload as {
            task_id: string;
            agent_id: string;
            timeout_duration_ms: number;
          };
          const result: RetrospectiveResult = {
            status: 'timeout',
            timeout_duration_ms: payload.timeout_duration_ms,
            event_id: event.event_id,
          };
          res.status(200).json(result);
          return;
        }

        if (event.event_type === TrajectoryEventType.RetrospectiveParseError) {
          const payload = event.payload as {
            task_id: string;
            agent_id: string;
            raw_response: string;
            parse_error: string;
          };
          const result: RetrospectiveResult = {
            status: 'parse_error',
            raw_response: payload.raw_response,
            parse_error: payload.parse_error,
            event_id: event.event_id,
          };
          res.status(200).json(result);
          return;
        }

        if (event.event_type === TrajectoryEventType.RetrospectiveValidationError) {
          const payload = event.payload as {
            task_id: string;
            agent_id: string;
            raw_response: string;
            validation_errors: Array<{ path: (string | number)[]; message: string }>;
          };
          const result: RetrospectiveResult = {
            status: 'validation_error',
            raw_response: payload.raw_response,
            validation_errors: payload.validation_errors,
            event_id: event.event_id,
          };
          res.status(200).json(result);
          return;
        }
      }

      // No retrospective found for this task
      res.status(404).json({
        error: `No retrospective found for task ${taskId}`,
      });
    } catch (err) {
      console.error('[TaskHandler] Error getting task retrospective:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type GetTaskDetailHandlerFn = ReturnType<typeof getTaskDetailHandler>;
export type GetTaskRetrospectiveHandlerFn = ReturnType<typeof getTaskRetrospectiveHandler>;
