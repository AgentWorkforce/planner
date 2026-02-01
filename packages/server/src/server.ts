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
} from './relay/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Configuration
// =============================================================================

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../planner.db');
const IDEATION_DB_PATH = process.env.IDEATION_DB_PATH || path.resolve(__dirname, '../../../ideation.db');

// =============================================================================
// Services
// =============================================================================

let plannerService: PlannerService;
let ideationService: IdeationService;

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

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Mount plugin routers
  app.use('/api', plannerService.router);
  app.use('/api/ideation', ideationService.router);

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

  // Initialize channel management
  initChannelManagement();

  // Sync plan channels with existing plans
  const storage = plannerService.getStorage();
  if (mode === 'connected') {
    const plans = storage.listPlans();
    const planIds = plans.map((p) => p.plan_id);
    syncPlanChannels(planIds);
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
  });

  // Initialize WebSocket proxy for relay communication
  const wss = initWebSocketProxy(server);
  console.log('[ws-proxy] WebSocket proxy attached to HTTP server');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

    // Stop PlannerLead service
    stopPlannerLead();

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
