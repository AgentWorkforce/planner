import type { Router } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import {
  listActiveAgentsHandler,
  type GetAgentPresenceFn,
} from '../handlers/agents.js';

// ============================================
// Types
// ============================================

/**
 * Options for registering agent routes.
 */
export interface RegisterAgentRoutesOptions {
  /**
   * Function to get agent presence information.
   */
  getAgentPresence?: GetAgentPresenceFn;
}

// ============================================
// Route Registration
// ============================================

/**
 * Registers agent-related routes on an Express router.
 *
 * Routes:
 * - GET /agents - List active agents
 *
 * @param router - Express router to register routes on
 * @param storage - ForgeStorage instance
 * @param options - Optional configuration
 */
export function registerAgentRoutes(
  router: Router,
  storage: ForgeStorage,
  options?: RegisterAgentRoutesOptions
): void {
  const handlerDeps = {
    storage,
    getAgentPresence: options?.getAgentPresence,
  };

  router.get('/agents', listActiveAgentsHandler(handlerDeps));

  // Alias: frontend calls /runs/:id/agents — forward as ?run_id query
  router.get('/runs/:id/agents', (req, res) => {
    req.query.run_id = req.params.id;
    return listActiveAgentsHandler(handlerDeps)(req, res);
  });
}
