import type { Router } from 'express';
import type { UserTrajectoryService } from '../../services/user-trajectory-service.js';
import { createUserTrajectoryHandlers } from '../handlers/user-trajectory.js';

/**
 * Registers user trajectory API routes on the router.
 *
 * Routes:
 * - POST   /user-trajectory/decisions           - Record a user decision
 * - GET    /user-trajectory/preferences/:category - Get preference by category
 * - PUT    /user-trajectory/preferences/:category - Override a preference
 * - DELETE /user-trajectory/preferences/:preferenceId - Delete a preference
 * - GET    /user-trajectory/preferences         - List all preferences
 * - GET    /user-trajectory/similar             - Find similar questions
 * - GET    /user-trajectory/auto-answer         - Try to auto-answer a question
 * - GET    /user-trajectory/history             - Get user trajectory history
 */
export function registerUserTrajectoryRoutes(
  router: Router,
  service: UserTrajectoryService
): void {
  const handlers = createUserTrajectoryHandlers(service);

  // Record a user decision
  router.post('/user-trajectory/decisions', handlers.recordDecision);

  // Get preference by category (with scope priority)
  router.get('/user-trajectory/preferences/:category', handlers.getPreference);

  // Override a preference
  router.put('/user-trajectory/preferences/:category', handlers.overridePreference);

  // Delete a preference
  router.delete('/user-trajectory/preferences/:preferenceId', handlers.deletePreference);

  // List all preferences
  router.get('/user-trajectory/preferences', handlers.listPreferences);

  // Find similar questions
  router.get('/user-trajectory/similar', handlers.findSimilar);

  // Try to auto-answer a question
  router.get('/user-trajectory/auto-answer', handlers.tryAutoAnswer);

  // Get trajectory history
  router.get('/user-trajectory/history', handlers.getHistory);
}
