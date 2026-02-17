import { Router } from 'express';
import type { SuggestionEngine } from '../services/suggestion-engine.js';
import type { PortfolioStorage } from '../storage/interface.js';
import { createOverviewHandlers } from './handlers/overview.js';
import { createSuggestionHandlers } from './handlers/suggestions.js';
import { createHealthHandlers } from './handlers/health.js';
import { createDecisionHandlers } from './handlers/decisions.js';

export function createPortfolioRouter(
  engine: SuggestionEngine,
  storage: PortfolioStorage,
): Router {
  const router = Router();

  const overview = createOverviewHandlers(engine);
  const suggestions = createSuggestionHandlers(engine);
  const health = createHealthHandlers(engine);
  const decisions = createDecisionHandlers(storage);

  router.get('/overview', overview.getOverview);
  router.get('/suggestions', suggestions.getSuggestions);
  router.get('/health/initiatives', health.getInitiativeHealth);
  router.get('/health/plans/:id', health.getPlanHealth);
  router.get('/decisions', decisions.listDecisions);
  router.post('/decisions', decisions.createDecision);

  return router;
}
