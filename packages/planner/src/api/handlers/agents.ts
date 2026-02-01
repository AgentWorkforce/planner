/**
 * Agent API handlers.
 *
 * Stub implementation for planner package.
 * The actual agent functionality requires the server package with relay.
 */

import type { Request, Response } from 'express';

/**
 * Agent role type.
 */
export type AgentRole =
  | 'planner-lead'
  | 'architect'
  | 'ui-designer'
  | 'data-modeler'
  | 'coder'
  | 'tester'
  | 'security';

/**
 * Agent state type.
 */
export type AgentState = 'idle' | 'working' | 'needs_input' | 'error';

/**
 * Agent info returned by the /api/agents endpoint.
 */
export interface AgentInfo {
  agentId: string;
  name: string;
  role?: AgentRole;
  displayName?: string;
  state: AgentState;
  activity?: string;
  thought?: string;
  isConnected: boolean;
}

/**
 * Create handlers for agent-related endpoints.
 * Stub implementation - returns empty list (relay not available).
 */
export function createAgentHandlers() {
  return {
    /**
     * GET /api/agents
     *
     * Returns empty list when relay is not available.
     */
    list: async (_req: Request, res: Response): Promise<void> => {
      // No relay connection in standalone planner package
      res.json({
        agents: [],
        meta: {
          totalConnected: 0,
          totalWithState: 0,
        },
      });
    },
  };
}
