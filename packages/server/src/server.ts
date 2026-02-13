/**
 * Planner Meta-Server
 *
 * Thin launcher that mounts the planner and ideation plugins.
 * This server has no business logic - it just composes plugins.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Plugin imports (relative paths to sibling packages)
import { createPlannerService, type PlannerService } from '../../planner/src/index.js';
import { createIdeationService, type IdeationService } from '../../ideation/src/index.js';
import { createSpecialistSpawner } from '../../ideation/src/relay/spawner.js';
import { createForgeService, type ForgeService, type ForgeExecutionMode } from '../../forge-core/src/index.js';
import {
  createMullService,
  TriggerManager,
  registerMullTriggers,
  type MullService,
  type TriggerCleanupFn,
} from '../../mull/src/index.js';

// Mull adapter implementations + bridge
import {
  ForgeDbAdapter,
  TrajectoryAdapter,
  RelayDaemonAdapter,
} from '../../mull/src/adapters/implementations/index.js';
import type { SessionAdapter } from '../../mull/src/adapters/core-types.js';
import { toMullAdapters } from '../../mull/src/adapters/adapter-bridge.js';

// Shared error handling
import { errorHandler } from '@plannr/errors';

// Middleware
import { timeoutMiddleware } from './middleware/timeout.js';

// Relay infrastructure
import {
  connect as connectRelay,
  destroy as destroyRelay,
  getRelayConfig,
  getRelayMode,
  initChannelManagement,
  registerPlanChannels,
  initWebSocketProxy,
  createSessionTimeoutService,
  initIdeationBridge,
  stopIdeationBridge,
  syncIdeationSessionChannels,
  planChannelMiddleware,
  qaChannelMiddleware,
  isConnected,
  spawnAgent,
  emitAgentStatusUpdate,
  type AgentState,
} from './relay/index.js';

// Forge spawner
import { spawnForgeTask, terminateForgeAgent, spawnGateAgent } from './relay/forge-spawner.js';

// Agent lifecycle
import { AgentLifecycleManager } from './agents/lifecycle.js';

// Server API routes (relay-aware channel handlers)
import { createServerRouter } from './api/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Configuration
// =============================================================================

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../planner.db');
const IDEATION_DB_PATH = process.env.IDEATION_DB_PATH || path.resolve(__dirname, '../../../ideation.db');
const FORGE_DB_PATH = process.env.FORGE_DB_PATH || path.resolve(__dirname, '../../../forge.db');
const MULL_MEMORY_DIR = process.env.MULL_MEMORY_DIR || path.resolve(__dirname, '../../../memory');

// =============================================================================
// Services
// =============================================================================

let plannerService: PlannerService;
let ideationService: IdeationService;
let forgeService: ForgeService;
let mullService: MullService;
let mullTriggerCleanup: TriggerCleanupFn | null = null;

// =============================================================================
// Main
// =============================================================================

async function start(): Promise<void> {
  // Initialize planner service
  plannerService = createPlannerService({ dbPath: DB_PATH });
  plannerService.initialize();
  console.log(`[planner] Initialized (database: ${DB_PATH})`);

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Request timeout middleware (before route handlers)
  app.use(timeoutMiddleware);

  // Mount plan channel middleware (intercepts POST /api/plans to create channels)
  app.use('/api', planChannelMiddleware);

  // Mount QA channel middleware (broadcasts QA messages when questions are answered)
  app.use('/api', qaChannelMiddleware);

  // Mount server API router (relay-aware channel handlers - must come BEFORE planner router)
  const storage = plannerService.getStorage();
  const serverRouter = createServerRouter(storage);
  app.use('/api', serverRouter);

  // Mount plugin routers
  app.use('/api', plannerService.router);
  // Ideation and Forge routers mounted after relay connection to enable specialist spawning and mode detection

  // Attempt relay connection (non-blocking on failure)
  const relayConfig = getRelayConfig();
  console.log(`[relay] Attempting connection to ${relayConfig.socketPath}...`);

  try {
    await connectRelay();
  } catch {
    // Connection errors are already logged in the client module
    // Server should continue starting even if relay is unavailable
  }

  const mode = getRelayMode();
  console.log(`[relay] Mode: ${mode}`);

  // Initialize ideation service (after relay connection to enable specialist spawning)
  const specialistSpawner = isConnected()
    ? createSpecialistSpawner({ spawnAgent })
    : undefined;

  ideationService = createIdeationService({
    dbPath: IDEATION_DB_PATH,
    plannerUrl: `http://localhost:${PORT}`,
    spawnAgent: specialistSpawner,
    reportStatus: (agentId, state, options) => {
      emitAgentStatusUpdate(agentId, state as AgentState, options);
    },
  });
  await ideationService.initialize();
  app.use('/api/ideation', ideationService.router);
  console.log(`[ideation] Initialized (database: ${IDEATION_DB_PATH})`);

  // Initialize forge service (after relay connection to enable real mode)
  // NEVER silently fall back to test mode — test mode must be explicit via FORGE_MODE=test
  const forgeMode: ForgeExecutionMode =
    (process.env.FORGE_MODE as ForgeExecutionMode) || 'real';

  if (forgeMode === 'real' && !isConnected()) {
    console.warn('[forge] WARNING: Relay not connected but mode is "real" — agents will fail until relay connects');
  }

  forgeService = createForgeService({
    dbPath: FORGE_DB_PATH,
    mode: forgeMode,
    spawnTask: spawnForgeTask,
    terminateAgent: terminateForgeAgent,
    spawnGateAgent: spawnGateAgent,
    plannerUrl: `http://localhost:${PORT}`,
    repoRoot: process.cwd(),
    worktreeBase: path.join(process.cwd(), '.forge-worktrees'),
  });
  await forgeService.initialize();
  app.use('/api/forge', forgeService.router);
  console.log(`[forge] Initialized (database: ${FORGE_DB_PATH}, mode: ${forgeMode})`);

  // Initialize mull service (after planner and forge — reads their databases)
  mullService = createMullService({
    memoryDir: MULL_MEMORY_DIR,
  });
  await mullService.initialize();

  // Wire mull adapters after relay connection established
  const sessionAdapters: SessionAdapter[] = [];

  // Forge DB adapter - reads trajectory events from forge runs
  sessionAdapters.push(new ForgeDbAdapter({
    dbPath: FORGE_DB_PATH,
    includeUserTrajectory: true,
    includePreferences: true,
  }));

  // Trajectory adapter - reads decision events from planner
  sessionAdapters.push(new TrajectoryAdapter({
    dbPath: DB_PATH,
  }));

  // Relay daemon adapter - reads agent session data (only if connected)
  if (isConnected()) {
    const relayConfig = getRelayConfig();
    const relayDataDir = path.dirname(relayConfig.socketPath);
    sessionAdapters.push(new RelayDaemonAdapter({
      dataDir: relayDataDir,
    }));
  }

  // Bridge SessionAdapter[] → MullAdapter[] for the pipeline
  const mullDir = path.resolve(__dirname, '../../../.mull');
  mullService.setAdapters(toMullAdapters(sessionAdapters, mullDir));

  app.use('/api/mull', mullService.router);
  console.log(`[mull] Initialized (memoryDir: ${MULL_MEMORY_DIR})`);

  // Wire real-time triggers (if enabled via config)
  const triggerEnabled = process.env.MULL_TRIGGERS_ENABLED !== 'false'; // Default: true
  if (triggerEnabled) {
    const mullAdapters = toMullAdapters(sessionAdapters, mullDir);
    const triggerManager = new TriggerManager({
      adapters: mullAdapters,
      config: {
        enabled: triggerEnabled,
        mullDir: path.resolve(__dirname, '../../../.mull'),
        memoryDir: MULL_MEMORY_DIR,
      },
    });

    mullTriggerCleanup = registerMullTriggers({
      triggerManager,
      enabled: triggerEnabled,
      trajectoryCapture: forgeService.getTrajectoryCapture(),
      retrospectiveService: forgeService.getRetrospectiveService(),
    });

    console.log('[mull:triggers] Real-time triggers enabled and wired to forge events');
  } else {
    console.log('[mull:triggers] Real-time triggers disabled via MULL_TRIGGERS_ENABLED=false');
  }

  // Initialize agent lifecycle manager (spawns/releases relay agents)
  const lifecycle = new AgentLifecycleManager({
    mcpServerUrl: `http://localhost:${PORT}`,
  });

  // Initialize ideation bridge (routes relay messages to ideation package)
  initIdeationBridge(lifecycle, ideationService.getStorage());

  // Initialize channel management
  initChannelManagement();

  // Register plan channels with existing plans (lazy joining on first use)
  if (mode === 'connected') {
    const plans = storage.listPlans();
    const planIds = plans.map((p) => p.plan_id);
    registerPlanChannels(planIds);

    // Sync ideation session channels with existing active sessions
    const ideationStorage = ideationService.getStorage();
    await syncIdeationSessionChannels(ideationStorage);
  }

  // Note: PlannerLead agents are now spawned on-demand via AgentLifecycleManager

  // Create session timeout service
  const sessionTimeoutService = createSessionTimeoutService(storage);
  sessionTimeoutService.start();

  // Mount error handler middleware (must be last)
  app.use(errorHandler);

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log('');
    console.log(`Planner API server running at http://localhost:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET    /api/plans');
    console.log('  POST   /api/plans');
    console.log('  GET    /api/plans/:id');
    console.log('  GET    /api/plans/:id/versions');
    console.log('  GET    /api/plans/:id/versions/:version');
    console.log('  POST   /api/plans/:id/versions/:version/submit');
    console.log('  POST   /api/plans/:id/versions/:version/approve');
    console.log('  POST   /api/plans/:id/versions/:version/publish');
    console.log('  GET    /api/health/relay');
    console.log('  GET    /api/capabilities');
    console.log('  GET    /api/channels');
    console.log('  GET    /api/channels/:id/messages');
    console.log('  GET    /api/channels/:id/presence');
    console.log('  WS     /ws/relay');
    console.log('');
    console.log('Ideation endpoints:');
    console.log('  GET    /api/ideation/sessions');
    console.log('  POST   /api/ideation/sessions');
    console.log('  GET    /api/ideation/sessions/:id');
    console.log('  POST   /api/ideation/sessions/:id/messages');
    console.log('  GET    /api/ideation/sessions/:id/events (SSE)');
    console.log('');
    console.log('Forge endpoints:');
    console.log('  GET    /api/forge/health');
    console.log('  GET    /api/forge/runs');
    console.log('  POST   /api/forge/runs');
    console.log('  GET    /api/forge/runs/:id');
    console.log('  GET    /api/forge/runs/:id/events (SSE)');
    console.log('');
    console.log('Mull endpoints:');
    console.log('  GET    /api/mull/status');
    console.log('  POST   /api/mull/run');
    console.log('  GET    /api/mull/topics');
    console.log('  GET    /api/mull/topics/:slug');
  });

  // Initialize WebSocket proxy for relay communication
  const wss = initWebSocketProxy(server);
  console.log('[ws-proxy] WebSocket proxy attached to HTTP server');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

    // Release all spawned agents
    await lifecycle.releaseAll();

    // Stop ideation bridge
    stopIdeationBridge();

    // Stop session timeout service
    sessionTimeoutService.stop();

    // Clean up mull triggers
    if (mullTriggerCleanup) {
      mullTriggerCleanup();
    }

    // Close WebSocket server
    wss.close(() => {
      console.log('[server] WebSocket server closed');
    });

    // Close HTTP server
    server.close(() => {
      console.log('[server] HTTP server closed');
    });

    // Disconnect relay
    destroyRelay();

    // Shutdown services
    plannerService.shutdown();
    await ideationService.shutdown();
    forgeService.shutdown();
    mullService.shutdown();

    // Exit after cleanup
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the server
start().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
