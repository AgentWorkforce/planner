import path from 'node:path';
import { type Router } from 'express';
import { createForgeStorage, type ForgeStorage } from './storage/index.js';
import { createForgeRouter } from './api/index.js';
import { createTestExecutor } from './services/test-executor.js';
import { createRunService, type OutcomeEmitter } from './services/run-service.js';
import { createOrchestrator } from './services/orchestrator.js';
import { TrajectoryCapture } from './services/trajectory-capture.js';
import { loadForgeConfig, createDefaultConfig, type ForgeConfig } from './config/forge-config.js';
import { TaskStatus } from './domain/types.js';
import type { ForgeExecutionMode, SpawnTaskFn, SpawnGateAgentFn } from './services/agent-spawner.js';
import type { TerminateAgentFn } from './services/recovery.js';
import { GateResultRegistry } from './services/gate-registry.js';
import { createPlannerClient } from './adapters/planner-client.js';
import { WorktreeManager } from './services/worktree-manager.js';
import { BuildCoordinator } from './services/build-coordinator.js';
import { AnalysisTool } from './services/analysis-tool.js';
import { createQuestionService } from './services/question-service.js';
import { UserTrajectoryService } from './services/user-trajectory-service.js';
import {
  createAnswerNotificationService,
  createNotifySubscribersFn,
} from './mcp/answer-notification.js';

// Domain exports
export * from './domain/index.js';

// Storage exports
export * from './storage/index.js';

// Services exports (durability & trajectory)
export * from './services/index.js';

// API exports (handlers & routes)
export * from './api/index.js';

// MCP exports (tools & server)
export * from './mcp/index.js';

// Config exports
export * from './config/index.js';

// Planner adapter exports
export * from './adapters/index.js';

// Prompt exports
export * from './prompts/index.js';

// =============================================================================
// Service Factory (for server integration)
// =============================================================================

/**
 * Configuration for the Forge service factory.
 */
export interface ForgeServiceConfig {
  /**
   * Path to the SQLite database file.
   */
  dbPath?: string;

  /**
   * Base URL for the tuner service (enables test executor → tuner integration).
   * Default: 'http://localhost:4002'
   */
  tunerUrl?: string;

  /**
   * Execution mode: 'test' (default), 'real', or 'training'
   */
  mode?: ForgeExecutionMode;

  /**
   * Function to spawn task agents — required for mode='real'
   */
  spawnTask?: SpawnTaskFn;

  /**
   * Function to terminate agents — used by recovery and orchestrator
   */
  terminateAgent?: TerminateAgentFn;

  /**
   * Function to spawn quality gate agents — enables agent-based quality gates
   */
  spawnGateAgent?: SpawnGateAgentFn;

  /**
   * Path to forge config YAML/JSON for role/scope mapping
   */
  forgeConfigPath?: string;

  /**
   * Base URL for the planner service (enables plan_id-based run creation and sub_plan_id resolution).
   * Default: 'http://localhost:3001'
   */
  plannerUrl?: string;

  /**
   * Root of the git repository. When provided, enables git worktree isolation
   * so each Forge run executes in its own worktree instead of the main checkout.
   */
  repoRoot?: string;

  /**
   * Base directory for worktree creation.
   * Default: '<repoRoot>/.forge-worktrees'
   */
  worktreeBase?: string;
}

/**
 * Forge service instance for server integration.
 */
export interface ForgeService {
  /**
   * Express router with all Forge API endpoints.
   */
  router: Router;

  /**
   * Initialize the service (async for future compatibility).
   */
  initialize: () => Promise<void>;

  /**
   * Shutdown the service and close resources.
   */
  shutdown: () => void;

  /**
   * Get the underlying storage instance.
   */
  getStorage: () => ForgeStorage;

  /**
   * Get the TrajectoryCapture instance for event listening.
   */
  getTrajectoryCapture: () => TrajectoryCapture;

  /**
   * Get the RetrospectiveService instance for event listening (may be undefined in test mode).
   */
  getRetrospectiveService: () => import('./services/retrospective-service.js').RetrospectiveService | undefined;

  /**
   * The active execution mode for this service instance.
   */
  mode: ForgeExecutionMode;

  /**
   * BuildCoordinator for tiered multi-plan builds.
   */
  buildCoordinator: BuildCoordinator;
}

/**
 * Creates a Forge service instance for mounting in a parent Express app.
 *
 * This is the recommended way to integrate Forge as a plugin in a larger
 * server (similar to createPlannerService and createIdeationService).
 *
 * @param config - Service configuration
 * @returns ForgeService instance
 */
export function createForgeService(config: ForgeServiceConfig = {}): ForgeService {
  const dbPath = config.dbPath || './forge.db';
  const tunerUrl = config.tunerUrl || process.env.TUNER_URL || 'http://localhost:4002';

  // Determine execution mode
  const mode: ForgeExecutionMode =
    config.mode ||
    (process.env.FORGE_MODE as ForgeExecutionMode) ||
    'test';

  console.log(`[ForgeService] Initializing in ${mode} mode`);

  // Create storage
  const storage = createForgeStorage(dbPath);

  // Create TrajectoryCapture (shared between RunService and MCP routes)
  const trajectoryCapture = new TrajectoryCapture(storage);

  // Create HTTP-based outcome emitter if tuner URL is provided
  // Error suppression: only log first failure, then suppress for 60 seconds
  let lastTaskErrorTime = 0;
  let lastRunErrorTime = 0;
  const ERROR_SUPPRESS_MS = 60000; // 60 seconds

  const outcomeEmitter: OutcomeEmitter | undefined = tunerUrl
    ? {
        async submitTaskOutcome(outcome) {
          try {
            const res = await fetch(`${tunerUrl}/api/tuner/outcomes/task`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(outcome),
            });
            if (!res.ok) throw new Error(`Tuner API returned ${res.status}`);
          } catch (err) {
            const now = Date.now();
            if (now - lastTaskErrorTime > ERROR_SUPPRESS_MS) {
              lastTaskErrorTime = now;
              throw err; // Re-throw so RunService logs it once
            }
            // Suppress — already logged recently
          }
        },
        async submitRunOutcome(outcome) {
          try {
            const res = await fetch(`${tunerUrl}/api/tuner/outcomes/run`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(outcome),
            });
            if (!res.ok) throw new Error(`Tuner API returned ${res.status}`);
          } catch (err) {
            const now = Date.now();
            if (now - lastRunErrorTime > ERROR_SUPPRESS_MS) {
              lastRunErrorTime = now;
              throw err;
            }
            // Suppress — already logged recently
          }
        },
      }
    : undefined;

  // Create PlannerClient (shared — used by router for plan_id runs and orchestrator for sub_plan_id)
  const plannerUrl = config.plannerUrl || 'http://localhost:3001';
  const plannerClient = createPlannerClient({ base_url: plannerUrl, timeout_ms: 30000 });

  // Mode-specific initialization
  let scheduleReadyTasks: (runId: string) => void;
  let registerBuildRunFn: ((buildId: string, runId: string) => void) | undefined;
  let terminateRunAgentsFn: ((runId: string) => void) | undefined;
  let worktreeManager: WorktreeManager | undefined;
  let gateRegistry: GateResultRegistry | undefined;
  let shutdownHook: (() => void) | undefined;
  let recoverRunningRunsFn: (() => Promise<void>) | undefined;

  if (mode === 'real') {
    // Real mode: Orchestrator + RunService + agent spawning
    if (!config.spawnTask) {
      throw new Error('[ForgeService] spawnTask function required for mode=real');
    }

    // Load or create ForgeConfig
    let forgeConfig: ForgeConfig;
    if (config.forgeConfigPath) {
      console.log(`[ForgeService] Loading config from ${config.forgeConfigPath}`);
      forgeConfig = loadForgeConfig(config.forgeConfigPath);
    } else {
      console.log('[ForgeService] Using default config (no forgeConfigPath provided)');
      forgeConfig = createDefaultConfig();
    }

    // Create RunService with timeout handlers wired to agent lifecycle
    const runService = createRunService({
      storage,
      trajectoryCapture,
      outcomeEmitter,
      signalAgentShutdown: config.terminateAgent
        ? async (agentId: string, reason: string) => {
            console.log(`[ForgeService] Terminating timed-out agent ${agentId}: ${reason}`);
            await config.terminateAgent!(agentId);
          }
        : undefined,
      failTaskWithTimeout: async (taskId: string, runId: string) => {
        const task = storage.getTask(taskId);
        if (!task) return;
        console.log(`[ForgeService] Failing timed-out task ${taskId} (run ${runId})`);
        storage.updateTask(taskId, { status: TaskStatus.Failed });
      },
    });

    // Create WorktreeManager if repoRoot is provided (enables worktree isolation)
    worktreeManager = config.repoRoot
      ? new WorktreeManager(
          config.repoRoot,
          config.worktreeBase || path.join(config.repoRoot, '.forge-worktrees')
        )
      : undefined;

    if (worktreeManager) {
      console.log('[ForgeService] Worktree isolation enabled');
    }

    // Create gate infrastructure for agent-based quality gates
    gateRegistry = config.spawnGateAgent ? new GateResultRegistry() : undefined;

    // Create AnalysisTool for PREP/POST quality gates
    const analysisTool = new AnalysisTool({ cli: 'claude' });

    // Create Orchestrator
    const orchestrator = createOrchestrator({
      storage,
      runService,
      spawnTask: config.spawnTask,
      terminateAgent: config.terminateAgent,
      forgeConfig,
      plannerClient,
      worktreeManager,
      analysisTool,
    });

    scheduleReadyTasks = (runId: string) => orchestrator.scheduleReadyTasks(runId);
    registerBuildRunFn = (buildId: string, runId: string) => orchestrator.registerBuildRun(buildId, runId);
    terminateRunAgentsFn = (runId: string) => orchestrator.terminateRunAgents(runId);
    recoverRunningRunsFn = () => orchestrator.recoverRunningRuns();
    shutdownHook = () => {
      if (gateRegistry) gateRegistry.shutdown();
      orchestrator.shutdown();
      runService.shutdown();
    };

    console.log('[ForgeService] Real mode orchestrator ready');
  } else {
    // Test or training mode: TestExecutor for mock execution
    const source = mode === 'test' ? 'test' : 'training';
    const testExecutor = createTestExecutor(storage, { tunerUrl, source });

    scheduleReadyTasks = (runId: string) => testExecutor.scheduleReadyTasks(runId);
    shutdownHook = undefined; // TestExecutor has no cleanup

    console.log(`[ForgeService] ${source} mode executor ready`);
  }

  // Create BuildCoordinator (shared across modes — uses scheduleReadyTasks)
  const buildCoordinator = new BuildCoordinator({
    storage,
    plannerClient,
    scheduleReadyTasks,
    registerBuildRun: registerBuildRunFn,
    terminateRunAgents: terminateRunAgentsFn,
    worktreeManager,
    trajectoryCapture,
  });

  // Create question-related services
  const userTrajectoryService = new UserTrajectoryService(storage);
  const answerNotificationService = createAnswerNotificationService(storage);
  const notifySubscribersFn = createNotifySubscribersFn(answerNotificationService);
  const questionService = createQuestionService(storage, trajectoryCapture, {
    notifySubscribers: notifySubscribersFn,
    userTrajectoryService,
  });

  // Create router with scheduleReadyTasks callback and trajectory capture (for MCP routes)
  // gateRegistry is only created in real mode — undefined in test mode is fine (MCP tool will error gracefully)
  const router = createForgeRouter({
    storage,
    trajectoryCapture,
    scheduleReadyTasks,
    plannerClient,
    buildCoordinator,
    gateRegistry,
    questionService,
    userTrajectoryService,
  });

  return {
    router,
    mode,
    buildCoordinator,
    initialize: async () => {
      // Storage is initialized on creation

      // Recover running runs from previous server instance (real mode only)
      if (recoverRunningRunsFn) {
        await recoverRunningRunsFn();
      }
    },
    shutdown: () => {
      if (shutdownHook) {
        shutdownHook();
      }
      storage.close();
    },
    getStorage: () => storage,
    getTrajectoryCapture: () => trajectoryCapture,
    getRetrospectiveService: () => undefined, // TODO: Wire RetrospectiveService when implemented
  };
}
