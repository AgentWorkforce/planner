import { Router } from 'express';
import type { PlanStorage } from '../storage/interface.js';
import { createPlanHandlers } from './handlers/plans.js';
import { createWorkflowHandlers } from './handlers/workflow.js';
import { createChangeRequestHandlers } from './handlers/change-requests.js';

/**
 * Create API router with all plan endpoints.
 */
export function createRouter(storage: PlanStorage): Router {
  const router = Router();
  const planHandlers = createPlanHandlers(storage);
  const workflowHandlers = createWorkflowHandlers(storage);
  const changeRequestHandlers = createChangeRequestHandlers(storage);

  // Plan routes
  router.post('/plans', planHandlers.create);
  router.get('/plans', planHandlers.list);
  router.get('/plans/:id', planHandlers.get);
  router.put('/plans/:id', planHandlers.update);
  router.get('/plans/:id/versions', planHandlers.listVersions);
  router.get('/plans/:id/versions/:version', planHandlers.getVersion);
  router.post('/plans/:id/versions', planHandlers.createVersion);

  // Workflow routes
  router.post('/plans/:id/versions/:version/submit', workflowHandlers.submit);
  router.post('/plans/:id/versions/:version/approve', workflowHandlers.approve);
  router.post('/plans/:id/versions/:version/publish', workflowHandlers.publish);

  // Change request routes
  router.post('/runs/:run_id/change-requests', changeRequestHandlers.create);
  router.get('/runs/:run_id/change-requests', changeRequestHandlers.listByRun);
  router.get('/plans/:id/change-requests', changeRequestHandlers.listByPlan);

  return router;
}
