/**
 * Tuner API Routes
 *
 * Mounts all API handlers under /api/tuner
 */

import { Router } from 'express';
import type { TunerServices } from '../services/factory.js';
import { createConfigHandlers } from './handlers/config.js';
import { createOutcomeHandlers } from './handlers/outcomes.js';
import { createInsightsHandlers } from './handlers/insights.js';

/**
 * Create all API routes.
 */
export function createRoutes(services: TunerServices): Router {
  const router = Router();

  // Create handlers
  const configHandlers = createConfigHandlers(services);
  const outcomeHandlers = createOutcomeHandlers(services);
  const insightsHandlers = createInsightsHandlers(services);

  // Config endpoints (Forge/Planner/Ideation read)
  router.get('/config/forge', configHandlers.getForgeConfig);
  router.get('/config/planner', configHandlers.getPlannerConfig);
  router.get('/config/ideation', configHandlers.getIdeationConfig);
  router.get('/config/version', configHandlers.getConfigVersion);

  // Outcome endpoints (Forge/Ideation/Planner writes, Testbench reads)
  router.post('/outcomes/task', outcomeHandlers.recordTaskOutcome);
  router.post('/outcomes/run', outcomeHandlers.recordRunOutcome);
  router.post('/outcomes/ideation', outcomeHandlers.recordIdeationOutcome);
  router.post('/outcomes/plan-quality', outcomeHandlers.recordPlanQualitySignal);
  router.get('/outcomes', outcomeHandlers.getOutcomesByRun);

  // Insights endpoints (Portfolio/CLI read)
  router.get('/insights/summary', insightsHandlers.getSummary);
  router.get('/insights/drift', insightsHandlers.getDriftAlerts);
  router.get('/insights/model-performance', insightsHandlers.getModelPerformance);
  router.get('/insights/baselines', insightsHandlers.getTaskBaselines);
  router.post('/insights/drift/:id/acknowledge', insightsHandlers.acknowledgeDriftAlert);

  return router;
}
