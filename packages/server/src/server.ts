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
import { createForgeService, type ForgeService, type ForgeExecutionMode } from '../../forge-core/src/index.js';

// Relay infrastructure
import {
  connect as connectRelay,
  destroy as destroyRelay,
  getRelayConfig,
  getRelayMode,
  initChannelManagement,
  syncPlanChannels,
  initWebSocketProxy,
  initPlannerLead,
  stopPlannerLead,
  createSessionTimeoutService,
  initIdeationBridge,
  stopIdeationBridge,
  syncIdeationSessionChannels,
  planChannelMiddleware,
  qaChannelMiddleware,
  isConnected,
} from './relay/index.js';

// Forge spawner
import { spawnForgeTask, terminateForgeAgent } from './relay/forge-spawner.js';

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

// =============================================================================
// Services
// =============================================================================

let plannerService: PlannerService;
let ideationService: IdeationService;
let forgeService: ForgeService;

// =============================================================================
// Main
// =============================================================================

async function start(): Promise<void> {
  // Initialize planner service
  plannerService = createPlannerService({ dbPath: DB_PATH });
  plannerService.initialize();
  console.log(`[planner] Initialized (database: ${DB_PATH})`);

  // Initialize ideation service
  ideationService = createIdeationService({ dbPath: IDEATION_DB_PATH });
  await ideationService.initialize();
  console.log(`[ideation] Initialized (database: ${IDEATION_DB_PATH})`);

  // Initialize forge service
  forgeService = createForgeService({ dbPath: FORGE_DB_PATH });
  await forgeService.initialize();
  console.log(`[forge] Initialized (database: ${FORGE_DB_PATH})`);

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Mount plan channel middleware (intercepts POST /api/plans to create channels)
  app.use('/api', planChannelMiddleware);

  // Mount QA channel middleware (broadcasts QA messages when questions are answered)
  app.use('/api', qaChannelMiddleware);

  // Mount server API router (relay-aware channel handlers - must come BEFORE planner router)
  const storage = plannerService.getStorage();
  const serverRouter = createServerRouter(storage);
  app.use('/api', serverRouter);

  // Mount plugin routers (forge mounted after relay connection to detect mode)
  app.use('/api', plannerService.router);
  app.use('/api/ideation', ideationService.router);
  app.use('/api/forge', forgeService.router);

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

  // Initialize forge service (after relay connection to enable real mode)
  const forgeMode: ForgeExecutionMode =
    (process.env.FORGE_MODE as ForgeExecutionMode) || (isConnected() ? 'real' : 'test');

  forgeService = createForgeService({
    dbPath: FORGE_DB_PATH,
    mode: forgeMode,
    spawnTask: isConnected() ? spawnForgeTask : undefined,
    terminateAgent: isConnected() ? terminateForgeAgent : undefined,
  });
  await forgeService.initialize();
  app.use('/api/forge', forgeService.router);
  console.log(`[forge] Initialized (database: ${FORGE_DB_PATH}, mode: ${forgeMode})`);

  // Initialize ideation bridge (routes relay messages to ideation package)
  initIdeationBridge();

  // Initialize channel management
  initChannelManagement();

  // Sync plan channels with existing plans
  if (mode === 'connected') {
    const plans = storage.listPlans();
    const planIds = plans.map((p) => p.plan_id);
    syncPlanChannels(planIds);

    // Sync ideation session channels with existing active sessions
    const ideationStorage = ideationService.getStorage();
    await syncIdeationSessionChannels(ideationStorage);
  }

  // Initialize PlannerLead agent
  initPlannerLead(storage);

  // Create session timeout service
  const sessionTimeoutService = createSessionTimeoutService(storage);
  sessionTimeoutService.start();

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
  });

  // Initialize WebSocket proxy for relay communication
  const wss = initWebSocketProxy(server);
  console.log('[ws-proxy] WebSocket proxy attached to HTTP server');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

    // Stop PlannerLead service
    stopPlannerLead();

    // Stop ideation bridge
    stopIdeationBridge();

    // Stop session timeout service
    sessionTimeoutService.stop();

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
