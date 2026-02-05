/**
 * Ideation Server - Standalone development server
 *
 * Run with: npm run dev (or npm start)
 */

import express from 'express';
import cors from 'cors';
import { createIdeationRouter } from './api/index.js';
import { SQLiteIdeationStorage } from './storage/index.js';
import { initNavigator } from './navigator/index.js';
import { initTunerIntegration, stopTunerIntegration } from './tuner/index.js';

const PORT = process.env.IDEATION_PORT || 3001;
const DB_PATH = process.env.IDEATION_DB_PATH || './ideation.db';

async function main() {
  // Initialize storage
  const storage = new SQLiteIdeationStorage(DB_PATH);
  await storage.initialize();

  // Initialize Tuner integration
  try {
    await initTunerIntegration();
    console.log('[Ideation Server] Tuner integration initialized');
  } catch (error) {
    console.warn('[Ideation Server] Tuner not available:', error instanceof Error ? error.message : error);
  }

  // Initialize Navigator service
  try {
    initNavigator({ storage });
    console.log('[Ideation Server] Navigator service initialized');
  } catch (error) {
    console.warn('[Ideation Server] Navigator not available:', error instanceof Error ? error.message : error);
  }

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Mount ideation API
  const ideationRouter = createIdeationRouter(storage);
  app.use('/api/ideation', ideationRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ideation' });
  });

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`[Ideation Server] Running on http://localhost:${PORT}`);
    console.log(`[Ideation Server] API: http://localhost:${PORT}/api/ideation`);
    console.log(`[Ideation Server] Database: ${DB_PATH}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Ideation Server] Shutting down...');
    stopTunerIntegration();
    server.close(() => {
      console.log('[Ideation Server] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[Ideation Server] Failed to start:', err);
  process.exit(1);
});
