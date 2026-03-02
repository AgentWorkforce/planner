/**
 * forge-next Express router factory.
 *
 * Mount the returned Router at your desired prefix, e.g.:
 *   app.use('/api/forge-next', createForgeNextRouter(deps));
 */

import { Router } from 'express';
import type { WorkflowRunner } from '@agent-relay/sdk/workflows';
import type { ForgeNextStorage } from '../storage/interface.js';
import type { GateManager } from '../gate-manager.js';
import type { QuestionManager } from '../question-manager.js';
import type { FetchedPlan } from './handlers.js';
import {
  createRunHandler,
  listRunsHandler,
  getRunHandler,
  pauseRunHandler,
  resumeRunHandler,
  cancelRunHandler,
} from './handlers.js';
import { listGatesHandler, approveGateHandler, rejectGateHandler } from './gate-handlers.js';
import {
  listQuestionsHandler,
  answerQuestionHandler,
  dismissQuestionHandler,
} from './question-handlers.js';
import { runEventsSSEHandler } from './sse.js';

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

export interface ForgeNextDeps {
  storage: ForgeNextStorage;
  runner: WorkflowRunner;
  gateManager: GateManager;
  questionManager: QuestionManager;
  /**
   * Fetches plan metadata and steps from the planner domain.
   * Injected so forge-next has no direct import dependency on @plannr/planner.
   */
  fetchPlan: (planId: string, version?: number) => Promise<FetchedPlan | null>;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createForgeNextRouter(deps: ForgeNextDeps): Router {
  const router = Router();

  // Run management
  router.post('/runs', createRunHandler(deps));
  router.get('/runs', listRunsHandler(deps));
  router.get('/runs/:id', getRunHandler(deps));
  router.get('/runs/:id/events', runEventsSSEHandler(deps));
  router.post('/runs/:id/pause', pauseRunHandler(deps));
  router.post('/runs/:id/resume', resumeRunHandler(deps));
  router.post('/runs/:id/cancel', cancelRunHandler(deps));

  // Gate management (nested under runs for listing, top-level for decisions)
  router.get('/runs/:runId/gates', listGatesHandler(deps));
  router.post('/gates/:id/approve', approveGateHandler(deps));
  router.post('/gates/:id/reject', rejectGateHandler(deps));

  // Question management
  router.get('/runs/:runId/questions', listQuestionsHandler(deps));
  router.post('/questions/:id/answer', answerQuestionHandler(deps));
  router.post('/questions/:id/dismiss', dismissQuestionHandler(deps));

  return router;
}
