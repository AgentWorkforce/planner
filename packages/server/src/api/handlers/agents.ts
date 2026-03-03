/**
 * Agent API Handlers
 *
 * Provides relay-aware agent listing that merges:
 * - PRESENCE: from relay daemon via listConnectedAgents()
 * - STATE: from activeAgents registry (working/idle/needs_input/error)
 */

import type { Request, Response } from 'express';
import {
  getRelay,
  getActiveAgents,
  getRelayMode,
  setPendingModel,
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

        const relay = getRelay();
        const activeAgents = getActiveAgents();

        // Get connected agents from relay (presence)
        let connectedAgentNames: Set<string> = new Set();
        if (relay) {
          try {
            const connectedAgents = await relay.listAgents();
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

        // Filter out system and user clients — only return real agents
        const filteredAgents = agents.filter((a) => {
          if (a.name === 'Relay') return false;
          if (a.name.startsWith('user-')) return false;
          if (a.name.startsWith('dev-user-')) return false;
          return true;
        });

        res.json({
          agents: filteredAgents,
          mode,
          meta: {
            totalConnected: filteredAgents.length,
            totalWithState: filteredAgents.filter((a) => activeAgents.has(a.agentId)).length,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[agents] Error listing agents:', message);
        res.status(500).json({ error: message });
      }
    },

    /**
     * POST /api/agents/:name/model
     *
     * Set the model for a running agent via relay daemon.
     * Body: { model: string }
     */
    setModel: async (req: Request, res: Response): Promise<void> => {
      try {
        const name = req.params.name as string;
        const { model } = req.body;

        if (!name) {
          res.status(400).json({ error: 'Agent name is required' });
          return;
        }

        if (!model || typeof model !== 'string') {
          res.status(400).json({ error: 'model is required and must be a string' });
          return;
        }

        const mode = getRelayMode();
        if (mode !== 'connected') {
          res.status(503).json({ error: 'Relay daemon not connected' });
          return;
        }

        // Queue the model change — it will be applied when the agent next goes idle.
        // This avoids blocking (the relay daemon waits for agent idle, which can timeout).
        setPendingModel(name, model);

        res.json({
          success: true,
          pending: true,
          name,
          model,
          message: 'Model will apply when agent finishes current response',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[agents] Error setting agent model:', message);
        res.status(500).json({ error: message });
      }
    },
  };
}
