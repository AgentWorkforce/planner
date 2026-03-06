/**
 * Cultivate API routes
 */

import { Router } from 'express';
import type { CultivateContext } from './types.js';
import { createGreenhouseHandlers } from './api/handlers/greenhouses.js';
import { createSignalHandlers } from './api/handlers/signals.js';
import { createClusterHandlers } from './api/handlers/clusters.js';
import { createSourceHandlers } from './api/handlers/sources.js';
import { createRecommendationHandlers } from './api/handlers/recommendations.js';
import { createPrdHandlers } from './api/handlers/prd.js';
import { createFilterRuleHandlers } from './api/handlers/filter-rules.js';
import { createDeadLetterHandlers } from './api/handlers/dead-letter.js';
import { createIngestionHandlers } from './api/handlers/ingestion.js';
import { createEventsHandler } from './api/handlers/events.js';
import { createProfileHandlers } from './api/handlers/profiles.js';
import { TunerClient } from './tuner/client.js';

/**
 * Create Express router for Cultivate API
 *
 * @param context - Initialized Cultivate context with all dependencies
 * @returns Express Router ready for mounting
 */
export function createCultivateRouter(context: CultivateContext): Router {
  const router = Router();

  /**
   * Health check endpoint
   */
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'cultivate',
      timestamp: new Date().toISOString(),
    });
  });

  // ========== Greenhouses ==========
  const greenhouseHandlers = createGreenhouseHandlers(context.storage);
  // Quick-start must be mounted before parameterized :id routes to avoid conflicts
  router.post('/greenhouses/quick-start', greenhouseHandlers.quickStart);
  router.post('/greenhouses', greenhouseHandlers.create);
  router.get('/greenhouses', greenhouseHandlers.list);
  router.get('/greenhouses/:id', greenhouseHandlers.get);
  router.patch('/greenhouses/:id', greenhouseHandlers.update);
  router.delete('/greenhouses/:id', greenhouseHandlers.remove);

  // ========== Signals ==========
  // Create TunerClient for outcome recording (optional)
  const tunerClient = context.config.tunerUrl
    ? new TunerClient(context.config.tunerUrl, context.storage, context.tunerConfig ?? undefined)
    : undefined;

  const signalHandlers = createSignalHandlers(context.storage, tunerClient);
  router.get('/signals', signalHandlers.list);
  router.get('/signals/:id', signalHandlers.get);
  router.post('/signals/:id/link', signalHandlers.link);
  router.post('/signals/:id/dismiss', signalHandlers.dismiss);

  // ========== Clusters ==========
  const clusterHandlers = createClusterHandlers(context.storage);
  router.get('/clusters', clusterHandlers.list);
  router.get('/clusters/:id', clusterHandlers.get);

  // ========== Sources ==========
  const sourceHandlers = createSourceHandlers(context.storage);
  router.post('/sources', sourceHandlers.create);
  router.get('/sources', sourceHandlers.list);
  router.get('/sources/:id', sourceHandlers.get);
  router.patch('/sources/:id', sourceHandlers.update);
  router.delete('/sources/:id', sourceHandlers.remove);

  // ========== Source Presets ==========
  router.get('/presets', sourceHandlers.presets);

  // ========== Filter Rules ==========
  const filterRuleHandlers = createFilterRuleHandlers(context.storage);
  router.post('/filter-rules', filterRuleHandlers.create);
  router.get('/filter-rules', filterRuleHandlers.list);
  router.get('/filter-rules/:id', filterRuleHandlers.get);
  router.patch('/filter-rules/:id', filterRuleHandlers.update);
  router.delete('/filter-rules/:id', filterRuleHandlers.remove);

  // ========== Ingestion ==========
  const ingestionHandlers = createIngestionHandlers(
    context.storage,
    context.queues.ingestDocument
  );
  router.post('/ingestion', ingestionHandlers.create);
  router.get('/ingestion/:id', ingestionHandlers.status);

  // ========== Recommendations ==========
  const recommendationHandlers = createRecommendationHandlers(
    context.storage,
    context.config.anthropicApiKey
  );
  router.get('/recommendations', recommendationHandlers.get);

  // ========== PRD Generation ==========
  const prdHandlers = createPrdHandlers(context.storage, context.config.anthropicApiKey);
  router.post('/prd/generate', prdHandlers.generate);

  // ========== Dead Letter Queue ==========
  const deadLetterHandlers = createDeadLetterHandlers(context.queues.processSignal);
  router.get('/dead-letter', deadLetterHandlers.list);
  router.post('/dead-letter/:id/replay', deadLetterHandlers.replay);
  router.post('/dead-letter/replay-all', deadLetterHandlers.replayAll);
  router.delete('/dead-letter/:id', deadLetterHandlers.remove);

  // ========== Profiles & ICP Segments ==========
  const profileHandlers = createProfileHandlers(context.storage);
  router.get('/profiles', profileHandlers.list);
  // Segment routes must be mounted before any parameterized /profiles/:id
  router.get('/profiles/segments', profileHandlers.listSegments);
  router.post('/profiles/segments/generate', profileHandlers.generateSegments);

  // ========== SSE Events ==========
  const eventsHandler = createEventsHandler(context.sseBroadcaster);
  router.get('/events', eventsHandler.stream);

  // ========== Config ==========
  // Config handlers (get, update) to be implemented if needed

  return router;
}
