import { Router } from 'express';
import type { PlanStorage } from '../storage/interface.js';
import { createPlanHandlers } from './handlers/plans.js';
import { createWorkflowHandlers } from './handlers/workflow.js';
import { createChangeRequestHandlers } from './handlers/change-requests.js';
import { createCommentHandlers } from './handlers/comments.js';
import { createImprovementHandlers } from './handlers/improvements.js';
import { createHealthHandlers } from './handlers/health.js';
import { createMcpHandlers } from './handlers/mcp.js';
import { createSessionHandlers } from './handlers/sessions.js';
import { createChatHandlers } from './handlers/chat.js';
import { createImportHandlers } from './handlers/import.js';
import { createEventsHandler } from './handlers/events.js';
import { createChannelHandlers } from './handlers/channels.js';
import { createInitiativeHandlers } from './handlers/initiatives.js';
import { createQuestionHandlers } from './handlers/questions.js';
import { createTrajectoryHandlers } from './handlers/trajectories.js';
import { createAgentHandlers } from './handlers/agents.js';
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
  const healthHandlers = createHealthHandlers();
  const mcpHandlers = createMcpHandlers(storage);
  const sessionHandlers = createSessionHandlers(storage);
  const chatHandlers = createChatHandlers(storage);
  const importHandlers = createImportHandlers(storage);
  const eventsHandler = createEventsHandler(storage);
  const channelHandlers = createChannelHandlers(storage);
  const initiativeHandlers = createInitiativeHandlers(storage);
  const questionHandlers = createQuestionHandlers(storage);
  const trajectoryHandlers = createTrajectoryHandlers(storage);
  const agentHandlers = createAgentHandlers();
  const mcpAuth = createOptionalMcpAuthMiddleware(storage);

  // Plan routes
  router.post('/plans', planHandlers.create);
  router.get('/plans', planHandlers.list);
  router.get('/plans/:id', planHandlers.get);
  router.put('/plans/:id', planHandlers.update);
  router.get('/plans/:id/versions', planHandlers.listVersions);
  router.get('/plans/:id/versions/:version', planHandlers.getVersion);
  router.post('/plans/:id/versions', planHandlers.createVersion);

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

  // Health check routes
  router.get('/health/relay', healthHandlers.relayHealth);

  // AI Chat routes
  router.post('/ai/chat', chatHandlers.chat);
  router.post('/ai/suggestions/apply', chatHandlers.applySuggestion);

  // Document import routes
  router.post('/plans/import', importHandlers.import);
  router.post('/plans/import/detect', importHandlers.detect);
  router.post('/plans/import/create', importHandlers.createFromImport);

  // MCP HTTP transport routes
  // List is public (no auth), call uses optional auth for session context
  router.post('/mcp/tools/list', mcpHandlers.listTools);
  router.post('/mcp/tools/call', mcpAuth, mcpHandlers.callTool);

  // Channel routes (relay messaging)
  router.get('/channels', channelHandlers.list);
  router.get('/channels/:id/messages', channelHandlers.messages);
  router.get('/channels/:id/presence', channelHandlers.presence);

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

  // Agent routes (merged presence + state)
  router.get('/agents', agentHandlers.list);

  return router;
}
