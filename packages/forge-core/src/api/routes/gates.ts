import type { Router } from 'express';
import type { GateService, ScheduleReadyTasksFn } from '../../services/gate-service.js';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import {
  approveGateHandler,
  rejectGateHandler,
  listPendingGatesHandler,
} from '../handlers/gates.js';
import { gateEventsSSEHandler, runEventsSSEHandler } from '../handlers/sse.js';

/**
 * Options for registering gate routes.
 */
export interface RegisterGateRoutesOptions {
  /**
   * Optional callback to resume scheduling after gate approval.
   * If not provided, the caller is responsible for triggering scheduling.
   */
  scheduleReadyTasks?: ScheduleReadyTasksFn;
  /**
   * Optional TrajectoryCapture for SSE event streaming.
   * If provided, SSE routes will be registered.
   */
  trajectoryCapture?: TrajectoryCapture;
}

/**
 * Registers gate-related routes on an Express router.
 *
 * Routes:
 * - POST /gates/:taskId/approve - Approve a gate
 * - POST /gates/:taskId/reject - Reject a gate
 * - GET /gates/pending - List pending gates
 * - GET /gates/events - SSE stream for all gate events (if trajectoryCapture provided)
 *
 * @param router - Express router to register routes on
 * @param gateService - GateService instance for gate operations
 * @param options - Optional configuration
 */
export function registerGateRoutes(
  router: Router,
  gateService: GateService,
  options?: RegisterGateRoutesOptions
): void {
  // List pending gates (placed before :taskId routes to avoid conflict)
  router.get('/gates/pending', listPendingGatesHandler(gateService));

  // Approve a gate
  router.post(
    '/gates/:taskId/approve',
    approveGateHandler(gateService, options?.scheduleReadyTasks)
  );

  // Reject a gate
  router.post('/gates/:taskId/reject', rejectGateHandler(gateService));

  // SSE events for all gates (if trajectory capture provided)
  if (options?.trajectoryCapture) {
    router.get('/gates/events', gateEventsSSEHandler(options.trajectoryCapture));
  }
}

/**
 * Registers run-specific SSE event routes.
 *
 * Routes:
 * - GET /runs/:id/events - SSE stream for gate events on a specific run
 *
 * @param router - Express router to register routes on
 * @param trajectoryCapture - TrajectoryCapture for event streaming
 */
export function registerRunEventsRoutes(
  router: Router,
  trajectoryCapture: TrajectoryCapture
): void {
  router.get('/runs/:id/events', runEventsSSEHandler(trajectoryCapture));
}
