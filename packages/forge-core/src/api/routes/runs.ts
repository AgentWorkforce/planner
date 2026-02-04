import type { Router } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import {
  createRunHandler,
  listRunsHandler,
  getRunHandler,
  getRunsCountsHandler,
  type ScheduleReadyTasksFn,
} from '../handlers/runs.js';
import {
  pauseRunHandler,
  resumeRunHandler,
  cancelRunHandler,
  type TerminateActiveAgentsFn,
} from '../handlers/run-control.js';
import { getTaskDetailHandler, getTaskRetrospectiveHandler } from '../handlers/tasks.js';
import { fullRunEventsSSEHandler, type RunEventsSSEDeps } from '../handlers/sse.js';

// ============================================
// Types
// ============================================

/**
 * Options for registering run routes.
 */
export interface RegisterRunRoutesOptions {
  /**
   * Function to schedule ready tasks after run creation or resume.
   */
  scheduleReadyTasks?: ScheduleReadyTasksFn;
  /**
   * Function to terminate active agents during cancellation.
   */
  terminateActiveAgents?: TerminateActiveAgentsFn;
  /**
   * TrajectoryCapture for event streaming and tracking.
   */
  trajectoryCapture?: TrajectoryCapture;
}

// ============================================
// Route Registration
// ============================================

/**
 * Registers run-related routes on an Express router.
 *
 * Routes:
 * - POST /runs - Create a new run from a plan
 * - GET /runs - List runs with optional filtering
 * - GET /runs/:id - Get run details with all tasks
 * - POST /runs/:id/pause - Pause a running run
 * - POST /runs/:id/resume - Resume a paused run
 * - POST /runs/:id/cancel - Cancel a run
 * - GET /runs/:id/tasks/:taskId - Get task details
 * - GET /runs/:id/tasks/:taskId/retrospective - Get task retrospective
 * - GET /runs/:id/events - SSE stream for run events
 *
 * @param router - Express router to register routes on
 * @param storage - ForgeStorage instance
 * @param options - Optional configuration
 */
export function registerRunRoutes(
  router: Router,
  storage: ForgeStorage,
  options?: RegisterRunRoutesOptions
): void {
  const runHandlerDeps = {
    storage,
    trajectoryCapture: options?.trajectoryCapture,
    scheduleReadyTasks: options?.scheduleReadyTasks,
  };

  const controlHandlerDeps = {
    storage,
    trajectoryCapture: options?.trajectoryCapture,
    terminateActiveAgents: options?.terminateActiveAgents,
    scheduleReadyTasks: options?.scheduleReadyTasks,
  };

  const taskHandlerDeps = {
    storage,
  };

  // Run CRUD operations
  router.post('/runs', createRunHandler(runHandlerDeps));
  router.get('/runs', listRunsHandler(runHandlerDeps));
  // Note: /runs/counts must come BEFORE /runs/:id to avoid matching "counts" as an ID
  router.get('/runs/counts', getRunsCountsHandler(runHandlerDeps));
  router.get('/runs/:id', getRunHandler(runHandlerDeps));

  // Run control operations
  router.post('/runs/:id/pause', pauseRunHandler(controlHandlerDeps));
  router.post('/runs/:id/resume', resumeRunHandler(controlHandlerDeps));
  router.post('/runs/:id/cancel', cancelRunHandler(controlHandlerDeps));

  // Task detail
  router.get('/runs/:id/tasks/:taskId', getTaskDetailHandler(taskHandlerDeps));

  // Task retrospective
  router.get('/runs/:id/tasks/:taskId/retrospective', getTaskRetrospectiveHandler(taskHandlerDeps));

  // SSE events (if trajectory capture provided)
  if (options?.trajectoryCapture) {
    const sseDeps: RunEventsSSEDeps = {
      trajectoryCapture: options.trajectoryCapture,
      storage,
    };
    router.get('/runs/:id/events', fullRunEventsSSEHandler(sseDeps));
  }
}
