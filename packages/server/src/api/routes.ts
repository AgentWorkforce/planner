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
import { createChatHandlers } from './handlers/chat.js';
import { createCapabilitiesHandlers } from './handlers/capabilities.js';

/** Storage interface subset needed for routes */
interface RouteStorage {
  listPlans(): Array<{ plan_id: string }>;
  getPlan(planId: string): { plan_id: string } | null;
  getSessionByPlanId(planId: string): { session_id: string; agent_id: string } | null;
  getLatestVersion(planId: string): { steps?: Array<{ title: string }> } | null;
}

/**
 * Create server API router with relay-aware handlers.
 */
export function createServerRouter(storage: RouteStorage): Router {
  const router = Router();
  const channelHandlers = createChannelHandlers(storage);
  const healthHandlers = createHealthHandlers();
  const agentHandlers = createAgentHandlers();
  const chatHandlers = createChatHandlers(storage);
  const capabilitiesHandlers = createCapabilitiesHandlers();

  // Health routes
  router.get('/health/relay', healthHandlers.relayHealth);
  router.get('/health/planner-lead', healthHandlers.plannerLeadHealth);

  // Capabilities routes
  router.get('/capabilities', capabilitiesHandlers.list);

  // Agent routes
  router.get('/agents', agentHandlers.list);

  // Channel routes
  router.get('/channels', channelHandlers.list);
  router.get('/channels/:id/messages', channelHandlers.messages);
  router.get('/channels/:id/presence', channelHandlers.presence);

  // Chat routes (relay-aware)
  router.post('/ai/chat', chatHandlers.chat);

  return router;
}
