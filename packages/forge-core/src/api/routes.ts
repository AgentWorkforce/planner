import { Router, type Request, type Response } from 'express';
import type { ForgeStorage } from '../storage/interface.js';
import type { TrajectoryCapture } from '../services/trajectory-capture.js';
import type { GateService, ScheduleReadyTasksFn } from '../services/gate-service.js';
import type { QuestionService } from '../services/question-service.js';
import type { UserTrajectoryService } from '../services/user-trajectory-service.js';
import type { GuardianService } from '../services/guardian-service.js';
import { registerRunRoutes, type RegisterRunRoutesOptions } from './routes/runs.js';
import { registerAgentRoutes, type RegisterAgentRoutesOptions } from './routes/agents.js';
import { registerGateRoutes, type RegisterGateRoutesOptions } from './routes/gates.js';
import { registerTrajectoryRoutes } from './routes/trajectory.js';
import { registerQuestionRoutes, type RegisterQuestionRoutesOptions } from './routes/questions.js';
import { registerUserTrajectoryRoutes } from './routes/user-trajectory.js';
import { registerGuardianRoutes } from './routes/guardians.js';
import { registerMCPRoutes } from './routes/mcp.js';
import type { GetAgentPresenceFn } from './handlers/agents.js';
import type { TerminateActiveAgentsFn } from './handlers/run-control.js';
import type { HealthCheckResponse } from './schemas.js';

// ============================================
// Types
// ============================================

/**
 * Dependencies for creating the Forge router.
 */
export interface ForgeRouterDeps {
  /**
   * Storage instance for all data operations.
   */
  storage: ForgeStorage;

  /**
   * TrajectoryCapture for event streaming and tracking (optional).
   */
  trajectoryCapture?: TrajectoryCapture;

  /**
   * GateService for human approval gates (optional).
   */
  gateService?: GateService;

  /**
   * QuestionService for agent question queue (optional).
   */
  questionService?: QuestionService;

  /**
   * UserTrajectoryService for user decision tracking (optional).
   */
  userTrajectoryService?: UserTrajectoryService;

  /**
   * GuardianService for guardian agent management (optional).
   */
  guardianService?: GuardianService;

  /**
   * Function to schedule ready tasks after run creation or gate approval.
   */
  scheduleReadyTasks?: ScheduleReadyTasksFn;

  /**
   * Function to terminate active agents during run cancellation.
   */
  terminateActiveAgents?: TerminateActiveAgentsFn;

  /**
   * Function to get agent presence information.
   */
  getAgentPresence?: GetAgentPresenceFn;
}

/**
 * Configuration for the Forge router.
 */
export interface ForgeRouterConfig {
  /**
   * Application version string for health check.
   */
  version?: string;

  /**
   * Application start time for uptime calculation.
   */
  startTime?: Date;
}

// ============================================
// Router Factory
// ============================================

/**
 * Creates the main Forge API router with all endpoints.
 *
 * Routes mounted:
 * - /health - Health check
 * - /runs/* - Run management and control
 * - /agents - Active agents list
 * - /gates/* - Gate management (if gateService provided)
 * - /questions/* - Question queue (if questionService provided)
 * - /trajectory/* - Trajectory events (if trajectoryCapture provided)
 *
 * @param deps - Dependencies for all handlers
 * @param config - Optional configuration
 * @returns Configured Express router
 */
export function createForgeRouter(
  deps: ForgeRouterDeps,
  config?: ForgeRouterConfig
): Router {
  const router = Router();

  // Health check endpoint
  router.get('/health', (_req: Request, res: Response) => {
    try {
      // Get active runs count
      let activeRunsCount = 0;
      let activeAgentsCount = 0;

      try {
        const activeRuns = deps.storage.getActiveRuns();
        activeRunsCount = activeRuns.length;

        // Count agents from running tasks
        for (const run of activeRuns) {
          const tasks = deps.storage.listTasksByRun(run.run_id);
          activeAgentsCount += tasks.filter(
            (t) => t.status === 'running' && t.agent_id
          ).length;
        }
      } catch {
        // Storage error - degraded health
        const response: HealthCheckResponse = {
          status: 'degraded',
          version: config?.version,
        };
        res.status(200).json(response);
        return;
      }

      // Calculate uptime
      let uptimeSeconds: number | undefined;
      if (config?.startTime) {
        uptimeSeconds = Math.floor(
          (Date.now() - config.startTime.getTime()) / 1000
        );
      }

      const response: HealthCheckResponse = {
        status: 'healthy',
        version: config?.version,
        uptime_seconds: uptimeSeconds,
        active_runs: activeRunsCount,
        active_agents: activeAgentsCount,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[Health] Error checking health:', err);
      const response: HealthCheckResponse = {
        status: 'unhealthy',
        version: config?.version,
      };
      res.status(503).json(response);
    }
  });

  // Run routes
  const runRoutesOptions: RegisterRunRoutesOptions = {
    scheduleReadyTasks: deps.scheduleReadyTasks,
    terminateActiveAgents: deps.terminateActiveAgents,
    trajectoryCapture: deps.trajectoryCapture,
  };
  registerRunRoutes(router, deps.storage, runRoutesOptions);

  // Agent routes
  const agentRoutesOptions: RegisterAgentRoutesOptions = {
    getAgentPresence: deps.getAgentPresence,
  };
  registerAgentRoutes(router, deps.storage, agentRoutesOptions);

  // Gate routes (if gate service provided)
  if (deps.gateService) {
    const gateRoutesOptions: RegisterGateRoutesOptions = {
      scheduleReadyTasks: deps.scheduleReadyTasks,
      trajectoryCapture: deps.trajectoryCapture,
    };
    registerGateRoutes(router, deps.gateService, gateRoutesOptions);
  }

  // Question routes (if question service provided)
  if (deps.questionService) {
    const questionRoutesOptions: RegisterQuestionRoutesOptions = {
      trajectoryCapture: deps.trajectoryCapture,
    };
    registerQuestionRoutes(router, deps.questionService, questionRoutesOptions);
  }

  // Trajectory routes (if trajectory capture provided)
  if (deps.trajectoryCapture) {
    registerTrajectoryRoutes(router, deps.storage);
  }

  // User trajectory routes (if user trajectory service provided)
  if (deps.userTrajectoryService) {
    registerUserTrajectoryRoutes(router, deps.userTrajectoryService);
  }

  // Guardian routes (if guardian service provided)
  if (deps.guardianService) {
    registerGuardianRoutes(router, deps.guardianService);
  }

  // MCP tool routes (if trajectory capture provided — needed for tool context)
  if (deps.trajectoryCapture) {
    registerMCPRoutes(router, deps.storage, {
      trajectoryCapture: deps.trajectoryCapture,
    });
  }

  return router;
}
