import { Router } from 'express';
import type { MullAdapter, MullConfig } from '../domain/types.js';
import { createRunHandler, createJobStatusHandler } from './handlers/run.js';
import { createStatusHandler } from './handlers/status.js';
import { createListTopicsHandler, createGetTopicHandler } from './handlers/topics.js';

// ============================================
// Types
// ============================================

export interface MullRouterDeps {
  adapters: MullAdapter[];
  memoryDir: string;
  config?: Partial<MullConfig>;
}

// ============================================
// Router Factory
// ============================================

/**
 * Creates the Mull API router with all endpoints.
 *
 * Routes mounted:
 * - GET  /status        - Memory system health and config
 * - POST /run           - Trigger mull pipeline (single session or batch) - async, returns job ID
 * - GET  /jobs/:jobId   - Get job status and result
 * - GET  /topics        - List all topic slugs
 * - GET  /topics/:slug  - Get topic detail (frontmatter + nuggets)
 */
export function createMullRouter(deps: MullRouterDeps): Router {
  const router = Router();

  // Pass deps directly — preserves getters (e.g. for dynamic adapter lists)
  router.get('/status', createStatusHandler(deps));
  router.post('/run', createRunHandler(deps));
  router.get('/jobs/:jobId', createJobStatusHandler());
  router.get('/topics', createListTopicsHandler(deps));
  router.get('/topics/:slug', createGetTopicHandler(deps));

  return router;
}
