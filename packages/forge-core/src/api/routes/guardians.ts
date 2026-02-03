import type { Router } from 'express';
import type { GuardianService } from '../../services/guardian-service.js';
import {
  listGuardiansHandler,
  getGuardianHandler,
  spawnGuardianHandler,
  stopGuardianHandler,
  getGuardianTrajectoryHandler,
  recordObservationHandler,
  generateRetrospectiveHandler,
} from '../handlers/guardians.js';

// ============================================
// Types
// ============================================

/**
 * Options for registering guardian routes.
 */
export interface RegisterGuardianRoutesOptions {
  // No additional options currently needed
}

// ============================================
// Route Registration
// ============================================

/**
 * Registers guardian-related routes on an Express router.
 *
 * Routes:
 * - GET /guardians - List active guardians
 * - GET /guardians/:guardianId - Get a specific guardian
 * - POST /guardians/:type/spawn - Spawn a new guardian
 * - POST /guardians/:guardianId/stop - Stop a guardian
 * - GET /guardians/:type/trajectory - Get guardian trajectory
 * - POST /guardians/:guardianId/observe - Record an observation
 * - POST /guardians/:guardianId/retrospective - Generate retrospective
 *
 * @param router - Express router to register routes on
 * @param guardianService - GuardianService instance
 * @param _options - Optional configuration (reserved for future use)
 */
export function registerGuardianRoutes(
  router: Router,
  guardianService: GuardianService,
  _options?: RegisterGuardianRoutesOptions
): void {
  const handlerDeps = {
    guardianService,
  };

  // List all active guardians
  // GET /guardians?project_id=xxx
  router.get('/guardians', listGuardiansHandler(handlerDeps));

  // Get guardian trajectory by type
  // GET /guardians/:type/trajectory?project_id=xxx
  router.get('/guardians/:type/trajectory', getGuardianTrajectoryHandler(handlerDeps));

  // Spawn a new guardian
  // POST /guardians/:type/spawn
  router.post('/guardians/:type/spawn', spawnGuardianHandler(handlerDeps));

  // Get a specific guardian
  // GET /guardians/:guardianId
  router.get('/guardians/:guardianId', getGuardianHandler(handlerDeps));

  // Stop a guardian
  // POST /guardians/:guardianId/stop
  router.post('/guardians/:guardianId/stop', stopGuardianHandler(handlerDeps));

  // Record an observation
  // POST /guardians/:guardianId/observe
  router.post('/guardians/:guardianId/observe', recordObservationHandler(handlerDeps));

  // Generate retrospective
  // POST /guardians/:guardianId/retrospective
  router.post('/guardians/:guardianId/retrospective', generateRetrospectiveHandler(handlerDeps));
}
