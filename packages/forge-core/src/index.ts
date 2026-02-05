import { type Router } from 'express';
import { createForgeStorage, type ForgeStorage } from './storage/index.js';
import { createForgeRouter } from './api/index.js';
import { createTestExecutor } from './services/test-executor.js';
import { createRunService, type OutcomeEmitter } from './services/run-service.js';
import { createOrchestrator } from './services/orchestrator.js';
import { loadForgeConfig, createDefaultConfig, type ForgeConfig } from './config/forge-config.js';
import type { ForgeExecutionMode, SpawnTaskFn } from './services/agent-spawner.js';
import type { TerminateAgentFn } from './services/recovery.js';

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
   * Path to forge config YAML/JSON for role/scope mapping
   */
  forgeConfigPath?: string;
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
   * The active execution mode for this service instance.
   */
  mode: ForgeExecutionMode;
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

  // Create HTTP-based outcome emitter if tuner URL is provided
  const outcomeEmitter: OutcomeEmitter | undefined = tunerUrl
    ? {
        async submitTaskOutcome(outcome) {
          const res = await fetch(`${tunerUrl}/api/tuner/outcomes/task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(outcome),
          });
          if (!res.ok) {
            throw new Error(`Tuner API returned ${res.status}`);
          }
        },
        async submitRunOutcome(outcome) {
          const res = await fetch(`${tunerUrl}/api/tuner/outcomes/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(outcome),
          });
          if (!res.ok) {
            throw new Error(`Tuner API returned ${res.status}`);
          }
        },
      }
    : undefined;

  // Mode-specific initialization
  let scheduleReadyTasks: (runId: string) => void;
  let shutdownHook: (() => void) | undefined;

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

    // Create RunService
    const runService = createRunService({
      storage,
      outcomeEmitter,
    });

    // Create Orchestrator
    const orchestrator = createOrchestrator({
      storage,
      runService,
      spawnTask: config.spawnTask,
      terminateAgent: config.terminateAgent,
      forgeConfig,
    });

    scheduleReadyTasks = (runId: string) => orchestrator.scheduleReadyTasks(runId);
    shutdownHook = () => {
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

  // Create router with scheduleReadyTasks callback
  const router = createForgeRouter({
    storage,
    scheduleReadyTasks,
  });

  return {
    router,
    mode,
    initialize: async () => {
      // Storage is initialized on creation, nothing async needed yet
    },
    shutdown: () => {
      if (shutdownHook) {
        shutdownHook();
      }
      storage.close();
    },
    getStorage: () => storage,
  };
}
