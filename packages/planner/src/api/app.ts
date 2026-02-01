import express from 'express';
import cors from 'cors';
import type { PlanStorage } from '../storage/interface.js';
import { createRouter } from './routes.js';
import { errorHandler } from './middleware.js';

/**
 * Create Express application with injected storage.
 */
export function createApp(storage: PlanStorage): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', createRouter(storage));

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
