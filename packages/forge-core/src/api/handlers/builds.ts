import type { Request, Response } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { BuildCoordinator } from '../../services/build-coordinator.js';
import { BuildRequestSchema, type Build, type BuildRun } from '../../domain/build-types.js';
import type {
  CreateBuildResponse,
  ListBuildsResponse,
  BuildWithRunsResponse,
  BuildControlResponse,
  ListBuildsQuery,
  BuildResponse,
  BuildRunResponse,
} from '../schemas.js';
import { ListBuildsQuerySchema } from '../schemas.js';

// ============================================
// Types
// ============================================

/**
 * Dependencies for build handlers.
 */
export interface BuildHandlerDeps {
  storage: ForgeStorage;
  buildCoordinator: BuildCoordinator;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Converts a Build entity to a BuildResponse.
 */
function toBuildResponse(build: Build): BuildResponse {
  return {
    build_id: build.build_id,
    status: build.status,
    tiers: build.tiers,
    concurrency_limit: build.concurrency_limit,
    skip_completed: build.skip_completed,
    mode: build.mode,
    workspace_path: build.workspace_path,
    error: build.error,
    created_at: build.created_at,
    started_at: build.started_at,
    completed_at: build.completed_at,
    updated_at: build.updated_at,
  };
}

/**
 * Converts a BuildRun entity to a BuildRunResponse.
 */
function toBuildRunResponse(buildRun: BuildRun): BuildRunResponse {
  return {
    build_id: buildRun.build_id,
    run_id: buildRun.run_id,
    plan_id: buildRun.plan_id,
    plan_version: buildRun.plan_version,
    tier: buildRun.tier,
    status: buildRun.status,
    created_at: buildRun.created_at,
    updated_at: buildRun.updated_at,
  };
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for POST /builds
 *
 * Creates a new build from a BuildRequest and starts async execution.
 */
export function createBuildHandler(deps: BuildHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const bodyResult = BuildRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Start the build via BuildCoordinator
      const build = await deps.buildCoordinator.startBuild(body);

      // Calculate counts for response
      const tiersCount = build.tiers.length;
      const plansCount = build.tiers.reduce((sum, tier) => sum + tier.plan_ids.length, 0);

      const response: CreateBuildResponse = {
        build_id: build.build_id,
        status: build.status,
        tiers_count: tiersCount,
        plans_count: plansCount,
      };

      res.status(201).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[BuildHandler] Error creating build:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /builds
 *
 * Lists builds with optional status filter.
 */
export function listBuildsHandler(deps: BuildHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      // Validate query parameters
      const queryResult = ListBuildsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;

      // Get all builds (optionally filtered by status)
      const builds = deps.storage.listBuilds(query.status);

      const response: ListBuildsResponse = {
        builds: builds.map(toBuildResponse),
        total: builds.length,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[BuildHandler] Error listing builds:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /builds/:id
 *
 * Returns full build details with all runs.
 */
export function getBuildHandler(deps: BuildHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const buildId = req.params.id as string;

      if (!buildId) {
        res.status(400).json({ error: 'Build ID is required' });
        return;
      }

      // Get build with runs
      const result = deps.buildCoordinator.getBuildWithRuns(buildId);
      if (!result) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const response: BuildWithRunsResponse = {
        ...toBuildResponse(result.build),
        runs: result.runs.map(toBuildRunResponse),
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[BuildHandler] Error getting build:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /builds/:id/pause
 *
 * Pauses a running build.
 */
export function pauseBuildHandler(deps: BuildHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const buildId = req.params.id as string;

      if (!buildId) {
        res.status(400).json({ error: 'Build ID is required' });
        return;
      }

      // Get current build first to capture previous status
      const currentBuild = deps.storage.getBuild(buildId);
      if (!currentBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const previousStatus = currentBuild.status;

      // Pause the build
      const updatedBuild = deps.buildCoordinator.pauseBuild(buildId);
      if (!updatedBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const response: BuildControlResponse = {
        build_id: updatedBuild.build_id,
        status: updatedBuild.status,
        previous_status: previousStatus,
        updated_at: updatedBuild.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[BuildHandler] Error pausing build:', error);

      // Check for validation errors (invalid transition)
      if (error.message.includes('Invalid Build state transition')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /builds/:id/resume
 *
 * Resumes a paused build.
 */
export function resumeBuildHandler(deps: BuildHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const buildId = req.params.id as string;

      if (!buildId) {
        res.status(400).json({ error: 'Build ID is required' });
        return;
      }

      // Get current build first to capture previous status
      const currentBuild = deps.storage.getBuild(buildId);
      if (!currentBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const previousStatus = currentBuild.status;

      // Resume the build
      const updatedBuild = deps.buildCoordinator.resumeBuild(buildId);
      if (!updatedBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const response: BuildControlResponse = {
        build_id: updatedBuild.build_id,
        status: updatedBuild.status,
        previous_status: previousStatus,
        updated_at: updatedBuild.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[BuildHandler] Error resuming build:', error);

      // Check for validation errors (invalid transition)
      if (error.message.includes('Invalid Build state transition')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /builds/:id/cancel
 *
 * Cancels a build and all its pending runs.
 */
export function cancelBuildHandler(deps: BuildHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const buildId = req.params.id as string;

      if (!buildId) {
        res.status(400).json({ error: 'Build ID is required' });
        return;
      }

      // Get current build first to capture previous status
      const currentBuild = deps.storage.getBuild(buildId);
      if (!currentBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const previousStatus = currentBuild.status;

      // Cancel the build
      const updatedBuild = deps.buildCoordinator.cancelBuild(buildId);
      if (!updatedBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const response: BuildControlResponse = {
        build_id: updatedBuild.build_id,
        status: updatedBuild.status,
        previous_status: previousStatus,
        updated_at: updatedBuild.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[BuildHandler] Error cancelling build:', error);

      // Check for validation errors (invalid transition)
      if (error.message.includes('Invalid Build state transition')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /builds/:id/retry
 *
 * Retries a failed build, re-executing failed runs and skipping completed ones.
 */
export function retryBuildHandler(deps: BuildHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const buildId = req.params.id as string;

      if (!buildId) {
        res.status(400).json({ error: 'Build ID is required' });
        return;
      }

      const currentBuild = deps.storage.getBuild(buildId);
      if (!currentBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const previousStatus = currentBuild.status;

      const updatedBuild = deps.buildCoordinator.retryBuild(buildId);
      if (!updatedBuild) {
        res.status(404).json({ error: `Build not found: ${buildId}` });
        return;
      }

      const response: BuildControlResponse = {
        build_id: updatedBuild.build_id,
        status: updatedBuild.status,
        previous_status: previousStatus,
        updated_at: updatedBuild.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[BuildHandler] Error retrying build:', error);

      if (error.message.includes('Invalid Build state transition')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type CreateBuildHandlerFn = ReturnType<typeof createBuildHandler>;
export type ListBuildsHandlerFn = ReturnType<typeof listBuildsHandler>;
export type GetBuildHandlerFn = ReturnType<typeof getBuildHandler>;
export type PauseBuildHandlerFn = ReturnType<typeof pauseBuildHandler>;
export type ResumeBuildHandlerFn = ReturnType<typeof resumeBuildHandler>;
export type CancelBuildHandlerFn = ReturnType<typeof cancelBuildHandler>;
export type RetryBuildHandlerFn = ReturnType<typeof retryBuildHandler>;
