/**
 * Planner Core API Server
 *
 * Starts the Express server with SQLite storage.
 */

import { createApp } from './api/app.js';
import { SqliteStorage } from './storage/sqlite.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { connect as connectRelay, destroy as destroyRelay } from './relay/client.js';
import { getRelayConfig } from './relay/config.js';
import { getRelayMode } from './relay/service.js';
import { createSessionTimeoutService } from './relay/session-timeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../planner.db');

// Initialize storage
const storage = new SqliteStorage(DB_PATH);

// Create app
const app = createApp(storage);

// Create session timeout service
const sessionTimeoutService = createSessionTimeoutService(storage);

/**
 * Start the server and initialize all services.
 */
async function start(): Promise<void> {
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

  // Start session timeout service
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
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

    // Stop session timeout service
    sessionTimeoutService.stop();

    // Close HTTP server
    server.close(() => {
      console.log('[server] HTTP server closed');
    });

    // Disconnect relay
    destroyRelay();

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
