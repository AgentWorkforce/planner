import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ForgeStorage, TrajectoryEventFilter } from '../../storage/interface.js';
import type { TrajectoryEvent } from '../../domain/types.js';
import { TrajectoryEventTypeSchema } from '../../domain/trajectory-events.js';

// ============================================
// Request Validation Schemas
// ============================================

/**
 * Query parameters for listing trajectory events.
 */
export const ListTrajectoryQuerySchema = z.object({
  event_type: z.string().optional(),
  task_id: z.string().uuid().optional(),
  from_time: z.string().datetime().optional(),
  to_time: z.string().datetime().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1).max(1000).optional()),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(0).optional()),
});

export type ListTrajectoryQuery = z.infer<typeof ListTrajectoryQuerySchema>;

/**
 * Query parameters for trajectory stats.
 */
export const TrajectoryStatsQuerySchema = z.object({
  by_step: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type TrajectoryStatsQuery = z.infer<typeof TrajectoryStatsQuerySchema>;

// ============================================
// Response Types
// ============================================

/**
 * Response format for trajectory list endpoint.
 */
export interface TrajectoryListResponse {
  events: TrajectoryEvent[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
}

/**
 * Task statistics derived from trajectory events.
 */
export interface TaskStats {
  step_id: string;
  step_title: string;
  attempts: number;
  completed: boolean;
  failed: boolean;
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
}

/**
 * Response format for trajectory stats endpoint.
 */
export interface TrajectoryStatsResponse {
  run_id: string;
  completion_rate: number;
  retry_rate: number;
  avg_task_duration_ms: number | null;
  avg_attempts_per_task: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_events: number;
  duration_ms?: number;
  by_step?: TaskStats[];
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for GET /runs/:id/trajectory
 *
 * Returns trajectory events for a run with pagination and filtering.
 */
export function getTrajectoryHandler(storage: ForgeStorage) {
  return (req: Request, res: Response): void => {
    try {
      const runId = req.params.id as string;

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      // Validate run exists
      const run = storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      // Parse and validate query parameters
      const queryResult = ListTrajectoryQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      // Build filter for storage query
      const filter: TrajectoryEventFilter = {};
      if (query.event_type) {
        filter.event_type = query.event_type;
      }
      if (query.task_id) {
        filter.task_id = query.task_id;
      }
      if (query.from_time) {
        filter.from_timestamp = query.from_time;
      }
      if (query.to_time) {
        filter.to_timestamp = query.to_time;
      }

      // Fetch all matching events (storage returns newest first)
      const allEvents = storage.listTrajectoryEvents(runId, filter);

      // Apply pagination
      const total = allEvents.length;
      const paginatedEvents = allEvents.slice(offset, offset + limit);
      const hasMore = offset + paginatedEvents.length < total;

      const response: TrajectoryListResponse = {
        events: paginatedEvents,
        total,
        has_more: hasMore,
        limit,
        offset,
      };

      res.json(response);
    } catch (err) {
      console.error('[TrajectoryHandler] Error fetching trajectory:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /runs/:id/trajectory/stats
 *
 * Returns aggregate statistics computed from trajectory events.
 */
export function getTrajectoryStatsHandler(storage: ForgeStorage) {
  return (req: Request, res: Response): void => {
    try {
      const runId = req.params.id as string;

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      // Validate run exists
      const run = storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      // Parse query parameters
      const queryResult = TrajectoryStatsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;

      // Fetch all events for this run
      const allEvents = storage.listTrajectoryEvents(runId);
      const tasks = storage.listTasksByRun(runId);

      // Compute basic statistics
      const taskStats = computeTaskStats(allEvents);
      const completedCount = taskStats.filter((s) => s.completed).length;
      const failedCount = taskStats.filter((s) => s.failed && !s.completed).length;
      const totalTasks = tasks.length;

      // Compute completion rate (completed / total)
      const completionRate = totalTasks > 0 ? completedCount / totalTasks : 0;

      // Compute retry rate (tasks with >1 attempt / total)
      const retriedCount = taskStats.filter((s) => s.attempts > 1).length;
      const retryRate = totalTasks > 0 ? retriedCount / totalTasks : 0;

      // Compute average task duration (from completed tasks)
      const completedWithDuration = taskStats.filter(
        (s) => s.completed && s.duration_ms !== undefined
      );
      const avgTaskDurationMs =
        completedWithDuration.length > 0
          ? completedWithDuration.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0) /
            completedWithDuration.length
          : null;

      // Compute average attempts per task
      const totalAttempts = taskStats.reduce((sum, s) => sum + s.attempts, 0);
      const avgAttemptsPerTask = taskStats.length > 0 ? totalAttempts / taskStats.length : 0;

      // Compute run duration
      let durationMs: number | undefined;
      if (run.started_at) {
        const startTime = new Date(run.started_at).getTime();
        const endTime = run.completed_at
          ? new Date(run.completed_at).getTime()
          : Date.now();
        durationMs = endTime - startTime;
      }

      const response: TrajectoryStatsResponse = {
        run_id: runId,
        completion_rate: Math.round(completionRate * 1000) / 1000,
        retry_rate: Math.round(retryRate * 1000) / 1000,
        avg_task_duration_ms: avgTaskDurationMs !== null ? Math.round(avgTaskDurationMs) : null,
        avg_attempts_per_task: Math.round(avgAttemptsPerTask * 100) / 100,
        total_tasks: totalTasks,
        completed_tasks: completedCount,
        failed_tasks: failedCount,
        total_events: allEvents.length,
        duration_ms: durationMs,
      };

      // Add per-step breakdown if requested
      if (query.by_step) {
        response.by_step = taskStats;
      }

      res.json(response);
    } catch (err) {
      console.error('[TrajectoryHandler] Error fetching trajectory stats:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Computes per-task statistics from trajectory events.
 */
function computeTaskStats(events: TrajectoryEvent[]): TaskStats[] {
  // Group events by task_id
  const taskEventsMap = new Map<string, TrajectoryEvent[]>();

  for (const event of events) {
    if (event.task_id) {
      const existing = taskEventsMap.get(event.task_id) ?? [];
      existing.push(event);
      taskEventsMap.set(event.task_id, existing);
    }
  }

  // Compute stats for each task
  const stats: TaskStats[] = [];

  for (const [taskId, taskEvents] of taskEventsMap) {
    // Sort events by timestamp (oldest first for processing)
    const sortedEvents = taskEvents.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Find task_started and task_completed events
    const startedEvents = sortedEvents.filter((e) => e.event_type === 'task_started');
    const completedEvents = sortedEvents.filter((e) => e.event_type === 'task_completed');
    const failedEvents = sortedEvents.filter((e) => e.event_type === 'task_failed');

    // Extract step info from any event that has it
    let stepId = '';
    let stepTitle = '';
    for (const event of sortedEvents) {
      const payload = event.payload as Record<string, unknown>;
      if (payload.step_id && typeof payload.step_id === 'string') {
        stepId = payload.step_id;
      }
      if (payload.step_title && typeof payload.step_title === 'string') {
        stepTitle = payload.step_title;
      }
      if (stepId && stepTitle) break;
    }

    // Count attempts (each task_started is an attempt)
    const attempts = startedEvents.length;

    // Check completion status
    const completed = completedEvents.length > 0;
    const failed = failedEvents.length > 0 && !completed;

    // Calculate duration from first start to completion
    let durationMs: number | undefined;
    let startedAt: string | undefined;
    let completedAt: string | undefined;

    if (startedEvents.length > 0 && startedEvents[0]) {
      startedAt = startedEvents[0].timestamp;
    }
    if (completedEvents.length > 0) {
      const lastCompleted = completedEvents[completedEvents.length - 1];
      if (lastCompleted) {
        completedAt = lastCompleted.timestamp;
      }
    }

    if (startedAt && completedAt) {
      durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    }

    stats.push({
      step_id: stepId,
      step_title: stepTitle,
      attempts,
      completed,
      failed,
      duration_ms: durationMs,
      started_at: startedAt,
      completed_at: completedAt,
    });
  }

  return stats;
}

/**
 * Export handler types for use elsewhere.
 */
export type TrajectoryHandler = ReturnType<typeof getTrajectoryHandler>;
export type TrajectoryStatsHandler = ReturnType<typeof getTrajectoryStatsHandler>;
