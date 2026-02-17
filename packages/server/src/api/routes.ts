/**
 * Server API Routes
 *
 * Creates Express router for server-specific endpoints that need
 * relay integration (channels, presence, etc.).
 *
 * These routes are mounted BEFORE the planner service router to override
 * the planner's stub channel handlers with relay-aware implementations.
 */

import { Router } from 'express';
import { createChannelHandlers } from './handlers/channels.js';
import { createHealthHandlers } from './handlers/health.js';
import { createAgentHandlers } from './handlers/agents.js';
import { createCapabilitiesHandlers } from './handlers/capabilities.js';
import { createGitHandlers } from './handlers/git.js';
import type { GitService } from '../services/git-service.js';

/** Storage interface subset needed for routes */
interface RouteStorage {
  listPlans(): Array<{ plan_id: string }>;
}

/**
 * Create server API router with relay-aware handlers.
 */
export function createServerRouter(storage: RouteStorage, gitService?: GitService): Router {
  const router = Router();
  const channelHandlers = createChannelHandlers(storage);
  const healthHandlers = createHealthHandlers();
  const agentHandlers = createAgentHandlers();
  const capabilitiesHandlers = createCapabilitiesHandlers();

  // Health routes
  router.get('/health/relay', healthHandlers.relayHealth);

  // Capabilities routes
  router.get('/capabilities', capabilitiesHandlers.list);

  // Agent routes
  router.get('/agents', agentHandlers.list);
  router.post('/agents/:name/model', agentHandlers.setModel);

  // Channel routes
  router.get('/channels', channelHandlers.list);
  router.get('/channels/:id/messages', channelHandlers.messages);
  router.get('/channels/:id/presence', channelHandlers.presence);

  // Git routes (only when git service is available)
  if (gitService) {
    const gitHandlers = createGitHandlers(gitService);
    router.get('/git/status', gitHandlers.status);
    router.get('/git/log', gitHandlers.log);
    router.get('/git/commits/:hash/files', gitHandlers.commitFiles);
  }

  return router;
}
