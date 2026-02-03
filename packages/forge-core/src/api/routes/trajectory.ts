import type { Router } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import {
  getTrajectoryHandler,
  getTrajectoryStatsHandler,
} from '../handlers/trajectory.js';

/**
 * Registers trajectory-related routes on an Express router.
 *
 * Routes:
 * - GET /runs/:id/trajectory - List trajectory events with filtering/pagination
 * - GET /runs/:id/trajectory/stats - Get aggregate statistics
 *
 * @param router - Express router to register routes on
 * @param storage - ForgeStorage instance for data access
 */
export function registerTrajectoryRoutes(
  router: Router,
  storage: ForgeStorage
): void {
  // List trajectory events with filtering and pagination
  router.get('/runs/:id/trajectory', getTrajectoryHandler(storage));

  // Get aggregate statistics for a run's trajectory
  router.get('/runs/:id/trajectory/stats', getTrajectoryStatsHandler(storage));
}
