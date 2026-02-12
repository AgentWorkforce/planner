import type { Router } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { BuildCoordinator } from '../../services/build-coordinator.js';
import {
  createBuildHandler,
  listBuildsHandler,
  getBuildHandler,
  pauseBuildHandler,
  resumeBuildHandler,
  cancelBuildHandler,
  retryBuildHandler,
} from '../handlers/builds.js';

// ============================================
// Types
// ============================================

/**
 * Options for registering build routes.
 */
export interface RegisterBuildRoutesOptions {
  /**
   * BuildCoordinator instance for build management.
   */
  buildCoordinator: BuildCoordinator;
}

// ============================================
// Route Registration
// ============================================

/**
 * Registers build-related routes on an Express router.
 *
 * Routes:
 * - POST /builds - Create a new build from tiers of plans
 * - GET /builds - List builds with optional status filter
 * - GET /builds/:id - Get build details with all runs
 * - POST /builds/:id/pause - Pause a running build
 * - POST /builds/:id/resume - Resume a paused build
 * - POST /builds/:id/retry - Retry a failed build
 * - POST /builds/:id/cancel - Cancel a build
 *
 * @param router - Express router to register routes on
 * @param storage - ForgeStorage instance
 * @param options - Configuration options
 */
export function registerBuildRoutes(
  router: Router,
  storage: ForgeStorage,
  options: RegisterBuildRoutesOptions
): void {
  const deps = {
    storage,
    buildCoordinator: options.buildCoordinator,
  };

  // Build CRUD operations
  router.post('/builds', createBuildHandler(deps));
  router.get('/builds', listBuildsHandler(deps));
  router.get('/builds/:id', getBuildHandler(deps));

  // Build control operations
  router.post('/builds/:id/pause', pauseBuildHandler(deps));
  router.post('/builds/:id/resume', resumeBuildHandler(deps));
  router.post('/builds/:id/retry', retryBuildHandler(deps));
  router.post('/builds/:id/cancel', cancelBuildHandler(deps));
}
