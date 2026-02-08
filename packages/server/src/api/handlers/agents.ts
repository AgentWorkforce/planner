/**
 * Agent API Handlers
 *
 * Provides relay-aware agent listing that merges:
 * - PRESENCE: from relay daemon via listConnectedAgents()
 * - STATE: from activeAgents registry (working/idle/needs_input/error)
 */

import type { Request, Response } from 'express';
import {
  getClient,
  getActiveAgents,
  getRelayMode,
  type AgentRole,
  type AgentState,
} from '../../relay/index.js';

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
 * Create relay-aware agent handlers.
 */
export function createAgentHandlers() {
  return {
    /**
     * GET /api/agents
     *
     * Returns merged presence + state for all agents.
     * Presence from relay listConnectedAgents(), state from activeAgents registry.
     */
    list: async (_req: Request, res: Response): Promise<void> => {
      try {
        const mode = getRelayMode();

        // In disconnected/mock mode, return empty list
        if (mode !== 'connected') {
          res.json({
            agents: [],
            mode,
            meta: {
              totalConnected: 0,
              totalWithState: 0,
            },
          });
          return;
        }

        const client = getClient();
        const activeAgents = getActiveAgents();

        // Get connected agents from relay (presence)
        let connectedAgentNames: Set<string> = new Set();
        if (client) {
          try {
            const connectedAgents = await client.listConnectedAgents();
            connectedAgentNames = new Set(connectedAgents.map((a) => a.name));
          } catch (error) {
            console.warn('[agents] Failed to get connected agents from relay:', error);
          }
        }

        // Build merged agent list - only include CONNECTED agents
        const agents: AgentInfo[] = [];

        // Add connected agents from state registry (with their state info)
        for (const [agentId, state] of activeAgents) {
          if (connectedAgentNames.has(agentId)) {
            agents.push({
              agentId,
              name: agentId,
              role: state.role,
              displayName: state.displayName,
              state: state.state,
              isConnected: true,
            });
          }
        }

        // Add connected agents that aren't in state registry (newly connected, no state yet)
        for (const name of connectedAgentNames) {
          if (!activeAgents.has(name)) {
            agents.push({
              agentId: name,
              name,
              displayName: name,
              state: 'idle',
              isConnected: true,
            });
          }
        }

        res.json({
          agents,
          mode,
          meta: {
            totalConnected: connectedAgentNames.size,
            totalWithState: activeAgents.size,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[agents] Error listing agents:', message);
        res.status(500).json({ error: message });
      }
    },
  };
}
