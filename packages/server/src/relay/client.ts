/**
 * Relay Client Wrapper
 *
 * Wraps @agent-relay/sdk client with connection management.
 * Handles errors gracefully - catches and logs, doesn't throw.
 */

import {
  RelayClient,
  type ClientState,
  type SendPayload,
  type SendMeta,
  type SpawnResultPayload,
  type ReleaseResultPayload,
} from '@agent-relay/sdk';
import { getRelayConfig, type RelayConfig } from './config.js';
import { emitAgentLeft } from './agent-status.js';

let client: RelayClient | null = null;
let connectionState: ClientState = 'DISCONNECTED';
let config: RelayConfig | null = null;

/** Connection metrics for health monitoring and debugging */
interface ConnectionMetrics {
  connectCount: number;
  disconnectCount: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  lastError: string | null;
  lastStateChangeAt: number;
  currentStateDurationMs: number;
}

const metrics: ConnectionMetrics = {
  connectCount: 0,
  disconnectCount: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastError: null,
  lastStateChangeAt: Date.now(),
  currentStateDurationMs: 0,
};

const stateChangeListeners: Set<(state: ClientState) => void> = new Set();

/** Message handler type */
type MessageHandler = (from: string, body: string, threadId?: string, data?: Record<string, unknown>) => void;

/** Registered message handlers */
const messageHandlers: Set<MessageHandler> = new Set();

/**
 * Register a handler for incoming messages.
 * Returns unsubscribe function.
 */
export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

/**
 * Internal: route incoming message to all registered handlers.
 */
function routeMessage(from: string, payload: SendPayload, messageId: string, meta?: SendMeta): void {
  const body = payload.body || '';
  const threadId = payload.thread;
  const data = payload.data;

  console.log(`[relay] Received message from ${from}${threadId ? ` (thread: ${threadId})` : ''}`);

  for (const handler of messageHandlers) {
    try {
      handler(from, body, threadId, data);
    } catch (error) {
      console.error('[relay] Error in message handler:', error);
    }
  }
}

/**
 * Connect to the relay daemon.
 * Connection errors are caught and logged, not thrown.
 */
export async function connect(): Promise<void> {
  if (client && connectionState === 'READY') {
    return;
  }

  config = getRelayConfig();

  try {
    client = new RelayClient({
      agentName: 'Relay',
      socketPath: config.socketPath,
      reconnect: true,
      maxReconnectAttempts: config.maxReconnectAttempts,
      reconnectDelayMs: config.reconnectInterval,
      reconnectMaxDelayMs: config.maxReconnectDelay,
      quiet: false,
    });

    client.onStateChange = (newState: ClientState) => {
      const oldState = connectionState;
      connectionState = newState;

      if (oldState !== newState) {
        const now = Date.now();
        const prevDuration = now - metrics.lastStateChangeAt;
        metrics.lastStateChangeAt = now;
        metrics.currentStateDurationMs = 0;

        if (newState === 'READY') {
          metrics.connectCount++;
          metrics.lastConnectedAt = now;
          console.log(`[relay] Connection state: ${oldState} -> READY (was ${oldState} for ${(prevDuration / 1000).toFixed(1)}s, connects: ${metrics.connectCount})`);
        } else if (newState === 'DISCONNECTED') {
          metrics.disconnectCount++;
          metrics.lastDisconnectedAt = now;
          console.log(`[relay] Connection state: ${oldState} -> DISCONNECTED (was ${oldState} for ${(prevDuration / 1000).toFixed(1)}s, disconnects: ${metrics.disconnectCount})`);
        } else {
          console.log(`[relay] Connection state: ${oldState} -> ${newState}`);
        }

        notifyStateChange(newState);
      }
    };

    client.onError = (error: Error) => {
      metrics.lastError = error.message;
      console.error('[relay] Client error:', error.message);
    };

    // Wire up message routing to registered handlers
    client.onMessage = routeMessage;

    // Wire up channel message routing - channel messages are different from direct messages
    client.onChannelMessage = (from: string, channel: string, body: string, envelope: { id: string; ts?: number; payload?: { data?: Record<string, unknown> } }) => {
      console.log(`[relay] Received channel message from ${from} in ${channel}: "${body.substring(0, 50)}..."`);
      // Route to handlers with channel info in data
      for (const handler of messageHandlers) {
        try {
          handler(from, body, undefined, { channel, messageId: envelope.id, ...envelope.payload?.data });
        } catch (error) {
          console.error('[relay] Error in message handler:', error);
        }
      }
    };

    await client.connect();
    console.log(`[relay] Connected to daemon at ${config.socketPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Failed to connect to daemon at ${config?.socketPath}: ${message}`);
    connectionState = 'DISCONNECTED';
  }
}

/**
 * Disconnect from the relay daemon.
 */
export function disconnect(): void {
  if (!client) {
    return;
  }

  try {
    client.disconnect();
    console.log('[relay] Disconnected from daemon');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Error during disconnect: ${message}`);
  } finally {
    connectionState = 'DISCONNECTED';
    notifyStateChange('DISCONNECTED');
  }
}

/**
 * Destroy the relay client permanently.
 */
export function destroy(): void {
  if (!client) {
    return;
  }

  try {
    client.destroy();
    console.log('[relay] Client destroyed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Error during destroy: ${message}`);
  } finally {
    client = null;
    connectionState = 'DISCONNECTED';
    notifyStateChange('DISCONNECTED');
  }
}

/**
 * Check if the client is connected.
 */
export function isConnected(): boolean {
  return connectionState === 'READY';
}

/**
 * Get the current connection state.
 */
export function getConnectionState(): ClientState {
  return connectionState;
}

/**
 * Get the relay client instance.
 * Returns null when not connected.
 */
export function getClient(): RelayClient | null {
  if (connectionState !== 'READY') {
    return null;
  }
  return client;
}

/**
 * Send a message to another agent.
 * Returns true if message was queued, false if not connected.
 */
export function sendMessage(
  to: string,
  body: string,
  kind?: string,
  data?: Record<string, unknown>,
  thread?: string
): boolean {
  if (!client || connectionState !== 'READY') {
    console.error('[relay] Cannot send message: not connected');
    return false;
  }

  return client.sendMessage(to, body, kind as 'message' | 'action' | 'state' | 'thinking', data, thread);
}

/**
 * Send a message to a channel.
 * Returns true if message was queued, false if not connected.
 */
export function sendChannelMessage(
  channel: string,
  body: string,
  data?: Record<string, unknown>
): boolean {
  console.log(`[relay] sendChannelMessage called: channel=${channel}, body="${body.substring(0, 50)}..."`);

  if (!client || connectionState !== 'READY') {
    console.error(`[relay] Cannot send channel message: not connected (client=${!!client}, state=${connectionState})`);
    return false;
  }

  const result = client.sendChannelMessage(channel, body, { data });
  console.log(`[relay] SDK sendChannelMessage result for ${channel}: ${result}`);
  return result;
}

/**
 * Subscribe to connection state changes.
 */
export function onStateChange(callback: (state: ClientState) => void): () => void {
  stateChangeListeners.add(callback);
  return () => {
    stateChangeListeners.delete(callback);
  };
}

function notifyStateChange(state: ClientState): void {
  for (const listener of stateChangeListeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('[relay] Error in state change listener:', error);
    }
  }
}

/** Options for spawning an agent */
export interface SpawnAgentOptions {
  name: string;
  task: string;
  cwd?: string;
  cli?: string;
  team?: string;
  /** Plan ID for context - enables channel join and MCP context */
  planId?: string;
  /** MCP server URL for agent tools (defaults to http://localhost:3001) */
  mcpServerUrl?: string;
  /** Channels to pre-join the agent to after spawning */
  channels?: string[];
}

/**
 * Track spawned agents for spawn metadata (PID, timestamp).
 * NOTE: This is NOT presence tracking. For actual presence (who's online),
 * use relay's listConnectedAgents(). This map tracks spawn metadata for
 * agents we spawned from this process.
 */
const spawnedAgents: Map<string, { pid?: number; spawnedAt: Date; channelId?: string }> = new Map();

/**
 * Build MCP context instructions for spawned agents.
 */
function buildMcpContext(options: SpawnAgentOptions): string {
  const mcpUrl = options.mcpServerUrl || 'http://localhost:3001';
  const agentId = options.name;

  let context = `
## MCP Integration - CRITICAL INSTRUCTIONS

⚠️ **DO NOT use Claude Code's built-in AskUserQuestion tool (mcp__conductor__AskUserQuestion)!**
That tool prompts in YOUR terminal, not in the planner UI where the user can see it.

Instead, you MUST call the planner MCP HTTP endpoint to ask questions.

### How to Call Planner MCP Tools

Use curl or fetch to call: ${mcpUrl}/api/mcp/tools/call

**Example - Report your status on startup:**
\`\`\`bash
curl -X POST ${mcpUrl}/api/mcp/tools/call \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "report_agent_status",
    "arguments": {
      "agent_id": "${agentId}",
      "role": "coder",
      "display_name": "${agentId}",
      "state": "working",
      "activity": "Starting task"
    }
  }'
\`\`\`

**Example - Ask user a question (THIS is how you ask questions!):**
\`\`\`bash
curl -X POST ${mcpUrl}/api/mcp/tools/call \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "ask_user_question",
    "arguments": {
      "agent_id": "${agentId}",
      "agent_role": "coder",
      "plan_id": "${options.planId || 'PLAN_ID_HERE'}",
      "text": "Your question here?",
      "options": ["Option A", "Option B", "Option C"],
      "blocking_level": "soft_block"
    }
  }'
\`\`\`

After calling ask_user_question, you must WAIT for the answer. Poll the question status or wait for a relay message with the answer.

### Available MCP Tools

1. **report_agent_status** - Report your state (working/idle/needs_input/error)
   - Call immediately on startup with agent_id: "${agentId}"
   - Update state as you work so the UI reflects your progress

2. **ask_user_question** - Submit question to the UI queue (NOT your terminal!)
   - Creates a question visible in the planner UI
   - Automatically sets your state to needs_input
   - The user answers in their browser, not in your terminal`;

  if (options.planId) {
    context += `

3. **join_plan_channel** - Join plan channel for messaging
   - You've been pre-joined to #plan-${options.planId.slice(0, 8)}
   - Use relay messaging to communicate in this channel

Plan context: You are working on plan ${options.planId}`;
  }

  return context;
}

/**
 * Spawn a new agent via the relay daemon.
 * Returns the spawn result with success/failure and PID.
 *
 * When planId is provided:
 * - MCP context is added to the task
 * - Agent is pre-joined to the plan channel
 */
export async function spawnAgent(options: SpawnAgentOptions): Promise<SpawnResultPayload> {
  if (!client || connectionState !== 'READY') {
    return {
      replyTo: '',
      success: false,
      name: options.name,
      error: 'Not connected to relay daemon',
    };
  }

  try {
    // Build task with MCP context
    const mcpContext = buildMcpContext(options);
    const taskWithContext = `${options.task}\n${mcpContext}`;

    const result = await client.spawn({
      name: options.name,
      cli: options.cli || 'claude',
      task: taskWithContext,
      cwd: options.cwd,
      team: options.team,
    });

    if (result.success) {
      const channelId = options.planId ? `#plan-${options.planId}` : undefined;
      spawnedAgents.set(options.name, {
        pid: result.pid,
        spawnedAt: new Date(),
        channelId,
      });
      console.log(`[relay] Spawned agent ${options.name} with PID ${result.pid}${channelId ? ` (channel: ${channelId})` : ''}`);

      // Pre-join agent to plan channel for immediate communication
      if (options.planId) {
        const channel = `#plan-${options.planId}`;
        const joined = client.adminJoinChannel(channel, options.name);
        if (joined) {
          console.log(`[relay] Pre-joined ${options.name} to ${channel}`);
        } else {
          console.warn(`[relay] Failed to pre-join ${options.name} to ${channel}`);
        }
      }

      // Pre-join agent to additional channels
      if (options.channels) {
        for (const channel of options.channels) {
          const joined = client.adminJoinChannel(channel, options.name);
          if (joined) {
            console.log(`[relay] Pre-joined ${options.name} to ${channel}`);
          } else {
            console.warn(`[relay] Failed to pre-join ${options.name} to ${channel}`);
          }
        }
      }
    } else {
      console.error(`[relay] Failed to spawn agent ${options.name}: ${result.error}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Error spawning agent ${options.name}: ${message}`);
    return {
      replyTo: '',
      success: false,
      name: options.name,
      error: message,
    };
  }
}

/**
 * Release (terminate) a spawned agent.
 */
export async function releaseAgent(name: string): Promise<ReleaseResultPayload> {
  if (!client || connectionState !== 'READY') {
    return {
      replyTo: '',
      success: false,
      name,
      error: 'Not connected to relay daemon',
    };
  }

  try {
    const result = await client.release(name);

    if (result.success) {
      spawnedAgents.delete(name);
      // Emit agent_left so UI knows agent is gone
      emitAgentLeft(name, 'released');
      console.log(`[relay] Released agent ${name}`);

      // Deregister from relay registry to prevent agents.json bloat.
      // Without this, every spawned agent stays in agents.json forever,
      // causing CPU spiral as the daemon iterates over hundreds of stale entries.
      try {
        await client.removeAgent(name, { removeMessages: true });
        console.log(`[relay] Deregistered agent ${name} from registry`);
      } catch (removeErr) {
        // Non-fatal — agent is already terminated, registry cleanup is best-effort
        console.warn(`[relay] Failed to deregister agent ${name}: ${removeErr instanceof Error ? removeErr.message : removeErr}`);
      }
    } else {
      console.error(`[relay] Failed to release agent ${name}: ${result.error}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Error releasing agent ${name}: ${message}`);
    return {
      replyTo: '',
      success: false,
      name,
      error: message,
    };
  }
}

/**
 * Get list of currently tracked spawned agents.
 */
export function getSpawnedAgents(): Array<{ name: string; pid?: number; spawnedAt: Date }> {
  return Array.from(spawnedAgents.entries()).map(([name, info]) => ({
    name,
    ...info,
  }));
}

/**
 * Check if an agent is currently spawned.
 */
export function isAgentSpawned(name: string): boolean {
  return spawnedAgents.has(name);
}

/**
 * Get the plan channel associated with a spawned agent.
 * Returns undefined if the agent wasn't spawned with a plan context.
 */
export function getSpawnedAgentChannel(name: string): string | undefined {
  return spawnedAgents.get(name)?.channelId;
}

/**
 * Get relay connection metrics for health monitoring.
 */
export function getConnectionMetrics(): ConnectionMetrics {
  return {
    ...metrics,
    currentStateDurationMs: Date.now() - metrics.lastStateChangeAt,
  };
}

// Re-export types
export type { ClientState, SpawnResultPayload, ReleaseResultPayload };
