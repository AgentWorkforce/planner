/**
 * Agent relay communication tools for PlannerLead.
 * Handles spawning, releasing, messaging, and listing agents.
 */

import {
  spawnAgent,
  releaseAgent,
  sendMessage,
  getSpawnedAgents,
  isAgentSpawned,
} from '../client.js';
import type { ToolResult, SpawnAgentInput, MessageAgentInput } from './types.js';

/**
 * Execute spawn_agent tool.
 * Spawns a worker agent via the relay daemon.
 * When channelId is provided (e.g. #plan-abc123), the agent is pre-joined
 * to the plan channel and gets MCP context about the plan.
 */
export async function executeSpawnAgent(input: SpawnAgentInput, channelId?: string): Promise<ToolResult> {
  try {
    // Check if agent with this name already exists
    if (isAgentSpawned(input.name)) {
      return {
        success: false,
        error: `Agent "${input.name}" is already spawned. Use a different name or release the existing agent first.`,
      };
    }

    // Extract planId from channel context for MCP integration and channel pre-join
    let planId: string | undefined;
    if (channelId) {
      const match = channelId.match(/^#plan-([a-f0-9-]+)$/i);
      planId = match?.[1];
    }

    const result = await spawnAgent({
      name: input.name,
      task: input.task,
      cwd: input.cwd,
      planId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to spawn agent',
      };
    }

    // Send initial message if provided
    if (input.initial_message) {
      sendMessage(input.name, input.initial_message, 'action');
    }

    return {
      success: true,
      result: {
        name: input.name,
        pid: result.pid,
        message: `Successfully spawned agent "${input.name}" with PID ${result.pid}. The agent is now ready to receive messages.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute release_agent tool.
 * Terminates a previously spawned agent.
 */
export async function executeReleaseAgent(input: { name: string }): Promise<ToolResult> {
  try {
    if (!isAgentSpawned(input.name)) {
      return {
        success: false,
        error: `Agent "${input.name}" is not currently spawned or was not spawned by PlannerLead.`,
      };
    }

    const result = await releaseAgent(input.name);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to release agent',
      };
    }

    return {
      success: true,
      result: {
        name: input.name,
        message: `Successfully released agent "${input.name}".`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute message_agent tool.
 * Sends a message to another agent.
 */
export async function executeMessageAgent(input: MessageAgentInput): Promise<ToolResult> {
  try {
    const sent = sendMessage(input.agent_name, input.message, 'action');

    if (!sent) {
      return {
        success: false,
        error: `Failed to send message to "${input.agent_name}". Not connected to relay or agent may not exist.`,
      };
    }

    return {
      success: true,
      result: {
        agent_name: input.agent_name,
        message: `Message sent to "${input.agent_name}".`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute list_agents tool.
 * Lists all agents spawned by PlannerLead.
 */
export async function executeListAgents(): Promise<ToolResult> {
  try {
    const agents = getSpawnedAgents();

    if (agents.length === 0) {
      return {
        success: true,
        result: {
          agents: [],
          message: 'No agents are currently spawned.',
        },
      };
    }

    return {
      success: true,
      result: {
        agents: agents.map((a) => ({
          name: a.name,
          pid: a.pid,
          uptime: Math.round((Date.now() - a.spawnedAt.getTime()) / 1000),
        })),
        message: `${agents.length} agent(s) currently spawned.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
