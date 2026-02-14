import { Router } from 'express';
import type { PlanStorage } from '../storage/interface.js';
import { createPlanHandlers } from './handlers/plans.js';
import { createWorkflowHandlers } from './handlers/workflow.js';
import { createChangeRequestHandlers } from './handlers/change-requests.js';
import { createCommentHandlers } from './handlers/comments.js';
import { createImprovementHandlers } from './handlers/improvements.js';
import { createMcpHandlers } from './handlers/mcp.js';
import { createSessionHandlers } from './handlers/sessions.js';
import { createImportHandlers } from './handlers/import.js';
import { createEventsHandler } from './handlers/events.js';
import { createInitiativeHandlers } from './handlers/initiatives.js';
import { createQuestionHandlers } from './handlers/questions.js';
import { createTrajectoryHandlers } from './handlers/trajectories.js';
import { createProjectHandlers } from './handlers/projects.js';
import { createSuggestionHandlers } from './handlers/chat.js';
import { createVersionDataHandlers } from './handlers/version-data.js';
import { createHierarchyHandlers } from './handlers/hierarchy.js';
import { createOptionalMcpAuthMiddleware } from './middleware/mcp-auth.js';

/**
 * Create API router with all plan endpoints.
 */
export function createRouter(storage: PlanStorage): Router {
  const router = Router();
  const planHandlers = createPlanHandlers(storage);
  const workflowHandlers = createWorkflowHandlers(storage);
  const changeRequestHandlers = createChangeRequestHandlers(storage);
  const commentHandlers = createCommentHandlers(storage);
  const improvementHandlers = createImprovementHandlers(storage);
  const mcpHandlers = createMcpHandlers(storage);
  const sessionHandlers = createSessionHandlers(storage);
  const importHandlers = createImportHandlers(storage);
  const eventsHandler = createEventsHandler(storage);
  const initiativeHandlers = createInitiativeHandlers(storage);
  const questionHandlers = createQuestionHandlers(storage);
  const trajectoryHandlers = createTrajectoryHandlers(storage);
  const projectHandlers = createProjectHandlers(storage);
  const suggestionHandlers = createSuggestionHandlers(storage);
  const versionDataHandlers = createVersionDataHandlers(storage);
  const hierarchyHandlers = createHierarchyHandlers(storage);
  const mcpAuth = createOptionalMcpAuthMiddleware(storage);

  // Plan routes
  router.post('/plans', planHandlers.create);
  router.get('/plans', planHandlers.list);
  router.get('/plans/:id', planHandlers.get);
  router.put('/plans/:id', planHandlers.update);
  router.get('/plans/:id/versions', planHandlers.listVersions);
  router.get('/plans/:id/versions/:version', planHandlers.getVersion);
  router.post('/plans/:id/versions', planHandlers.createVersion);
  router.post('/plans/:id/versions/:version/restore', planHandlers.restoreVersion);

  // Version data routes (context & understanding)
  router.patch('/plans/:id/context/:role', versionDataHandlers.updateContext);
  router.patch('/plans/:id/understanding/:role', versionDataHandlers.updateUnderstanding);

  // Sub-plan hierarchy routes
  router.get('/plans/:id/sub-plans', hierarchyHandlers.listSubPlans);
  router.get('/plans/:id/dependents', hierarchyHandlers.listDependents);
  router.get('/plans/:id/resolved', hierarchyHandlers.getResolved);

  // Session routes
  router.get('/plans/:id/session', sessionHandlers.getSession);
  router.post('/plans/:id/session', sessionHandlers.createSession);
  router.delete('/plans/:id/session', sessionHandlers.terminateSession);

  // SSE events route (for real-time plan sync)
  router.get('/plans/:id/events', eventsHandler.planEvents);

  // Workflow routes
  router.post('/plans/:id/versions/:version/submit', workflowHandlers.submit);
  router.post('/plans/:id/versions/:version/approve', workflowHandlers.approve);
  router.post('/plans/:id/versions/:version/publish', workflowHandlers.publish);

  // Change request routes
  router.post('/runs/:run_id/change-requests', changeRequestHandlers.create);
  router.get('/runs/:run_id/change-requests', changeRequestHandlers.listByRun);
  router.get('/plans/:id/change-requests', changeRequestHandlers.listByPlan);
  router.post('/change-requests/:id/accept-revision', changeRequestHandlers.acceptRevision);
  router.post('/change-requests/:id/reject-revision', changeRequestHandlers.rejectRevision);

  // Comment routes
  router.post('/plans/:id/versions/:version/comments', commentHandlers.create);
  router.get('/plans/:id/versions/:version/comments', commentHandlers.listByVersion);
  router.get('/plans/:id/versions/:version/steps/:stepId/comments', commentHandlers.listByStep);
  router.get('/plans/:id/versions/:version/comments/:commentId', commentHandlers.get);
  router.patch('/plans/:id/versions/:version/comments/:commentId', commentHandlers.update);
  router.post('/plans/:id/versions/:version/comments/:commentId/resolve', commentHandlers.resolve);
  router.post('/plans/:id/versions/:version/comments/:commentId/unresolve', commentHandlers.unresolve);
  router.delete('/plans/:id/versions/:version/comments/:commentId', commentHandlers.delete);

  // Improvement routes
  router.get('/plans/:id/versions/:version/improvements', improvementHandlers.list);
  router.get('/plans/:id/versions/:version/improvements/pending', improvementHandlers.listPending);
  router.get('/plans/:id/versions/:version/improvements/:improvementId', improvementHandlers.get);
  router.post('/plans/:id/versions/:version/improvements/:improvementId/accept', improvementHandlers.accept);
  router.post('/plans/:id/versions/:version/improvements/:improvementId/dismiss', improvementHandlers.dismiss);

  // Document import routes
  router.post('/plans/import', importHandlers.import);
  router.post('/plans/import/detect', importHandlers.detect);
  router.post('/plans/import/create', importHandlers.createFromImport);

  // MCP HTTP transport routes
  // List is public (no auth), call uses optional auth for session context
  router.post('/mcp/tools/list', mcpHandlers.listTools);
  router.post('/mcp/tools/call', mcpAuth, mcpHandlers.callTool);

  // Initiative routes
  router.get('/initiatives', initiativeHandlers.list);
  router.get('/initiatives/:id', initiativeHandlers.get);
  router.post('/initiatives', initiativeHandlers.create);
  router.put('/initiatives/:id', initiativeHandlers.update);
  router.delete('/initiatives/:id', initiativeHandlers.delete);

  // Question routes (agent questions queue)
  router.post('/plans/:id/questions', questionHandlers.create);
  router.get('/plans/:id/questions', questionHandlers.list);
  router.get('/plans/:id/questions/:questionId', questionHandlers.get);
  router.post('/plans/:id/questions/:questionId/answer', questionHandlers.answer);
  router.post('/plans/:id/questions/:questionId/dismiss', questionHandlers.dismiss);
  router.post('/plans/:id/questions/:questionId/subscribe', questionHandlers.subscribe);
  router.post('/plans/:id/questions/check-duplicates', questionHandlers.checkDuplicates);

  // Trajectory routes (user decision tracking)
  router.get('/plans/:id/trajectory/events', trajectoryHandlers.listEvents);
  router.post('/plans/:id/trajectory/decision', trajectoryHandlers.recordDecision);
  router.get('/plans/:id/trajectory/preferences', trajectoryHandlers.getPreferences);
  router.get('/plans/:id/trajectory/similar', trajectoryHandlers.findSimilar);

  // AI suggestion routes
  router.post('/ai/suggestions/apply', suggestionHandlers.applySuggestion);

  // Project routes
  router.get('/projects', projectHandlers.list);
  router.post('/projects', projectHandlers.create);
  router.get('/projects/:id', projectHandlers.get);
  router.put('/projects/:id', projectHandlers.update);
  router.post('/projects/:id/focus', projectHandlers.updateFocus);
  router.post('/projects/:id/graduate', projectHandlers.graduate);

  return router;
}
