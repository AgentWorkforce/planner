/**
 * Tuner HTTP Server
 *
 * Provides REST API for:
 * - Config distribution (Forge/Planner read)
 * - Outcome ingestion (Forge writes)
 * - Insights (Portfolio/CLI read)
 */

import express from 'express';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { createTunerServices } from './services/factory.js';
import { createRoutes } from './api/routes.js';

const PORT = parseInt(process.env.TUNER_PORT || '4002', 10);
const DB_PATH = process.env.TUNER_DB_PATH || '.data/tuner.db';

async function main() {
  console.log(`[tuner] Starting Tuner server...`);
  console.log(`[tuner] DB path: ${DB_PATH}`);

  // Ensure data directory exists
  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Initialize services
  const services = createTunerServices(DB_PATH);
  console.log(`[tuner] Services initialized`);

  // Create Express app
  const app = express();
  app.use(express.json());

  // Mount API routes
  app.use('/api/tuner', createRoutes(services));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'tuner' });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[tuner] Received SIGTERM, shutting down...');
    services.storage.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[tuner] Received SIGINT, shutting down...');
    services.storage.close();
    process.exit(0);
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`[tuner] Server listening on port ${PORT}`);
    console.log(`[tuner] Endpoints:`);
    console.log(`[tuner]   GET  /api/tuner/config/forge`);
    console.log(`[tuner]   GET  /api/tuner/config/planner`);
    console.log(`[tuner]   GET  /api/tuner/config/version`);
    console.log(`[tuner]   POST /api/tuner/outcomes/task`);
    console.log(`[tuner]   POST /api/tuner/outcomes/run`);
    console.log(`[tuner]   GET  /api/tuner/insights/summary`);
    console.log(`[tuner]   GET  /api/tuner/insights/drift`);
    console.log(`[tuner]   GET  /api/tuner/insights/model-performance`);
    console.log(`[tuner]   POST /api/tuner/insights/drift/:id/acknowledge`);
  });
}

main().catch((err) => {
  console.error('[tuner] Failed to start:', err);
  process.exit(1);
});
