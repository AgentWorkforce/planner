/**
 * Relay Client Wrapper
 *
 * Wraps @agent-relay/sdk AgentRelay (3.x) with connection management.
 * Fail fast: errors propagate — no fallbacks, no mock modes, no silent swallowing.
 */

import { AgentRelay, type Agent, type HumanHandle } from '@agent-relay/sdk';
import { getRelayConfig } from './config.js';
import { emitAgentLeft } from './agent-status.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Connection state for the embedded relay broker */
export type ConnectionState = 'connected' | 'disconnected';

/** Result from a successful agent spawn */
export interface SpawnResult {
  name: string;
}

/** Result from relay daemon's set-model operation */
export interface SetModelResult {
  replyTo: string;
  success: boolean;
  name: string;
  error?: string;
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
  /** Skip MCP context injection — forge agents use curl-based reporting, not relay */
  skipMcpContext?: boolean;
  /** Model to use for the spawned agent */
  model?: string;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let relay: AgentRelay | null = null;
let humanHandle: HumanHandle | null = null;

/**
 * Agent handles keyed by name — single source of truth for tracked agents.
 * Use agentHandles.has() for presence, agent.channels?.[0] for channel,
 * agent.exitCode/exitSignal for exit info.
 */
const agentHandles = new Map<string, Agent>();

let connected = false;

/** Connection state change listeners */
const stateChangeListeners: Set<(state: ConnectionState) => void> = new Set();

/** Message handler type */
type MessageHandler = (from: string, to: string, body: string, threadId?: string, data?: Record<string, unknown>) => void;

/** Registered message handlers */
const messageHandlers: Set<MessageHandler> = new Set();

/** Agent exit info passed to exit listeners */
export interface AgentExitInfo {
  name: string;
  exitCode?: number;
  exitSignal?: string;
}

/** Agent exit listeners */
type AgentExitHandler = (info: AgentExitInfo) => void;
const agentExitListeners: Set<AgentExitHandler> = new Set();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function notifyStateChange(state: ConnectionState): void {
  for (const listener of stateChangeListeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('[relay] Error in state change listener:', error);
    }
  }
}

function routeMessage(from: string, to: string, body: string, threadId?: string, data?: Record<string, unknown>): void {
  console.log(`[relay] Received message from ${from} → ${to}${threadId ? ` (thread: ${threadId})` : ''}`);
  for (const handler of messageHandlers) {
    try {
      handler(from, to, body, threadId, data);
    } catch (error) {
      console.error('[relay] Error in message handler:', error);
    }
  }
}

function handleAgentExited(agent: Agent): void {
  const name = agent.name;
  agentHandles.delete(name);

  console.log(`[relay] Agent exited: ${name} (code: ${agent.exitCode ?? 'unknown'})`);

  emitAgentLeft(name, 'exited');

  for (const listener of agentExitListeners) {
    try {
      listener({ name, exitCode: agent.exitCode, exitSignal: agent.exitSignal });
    } catch (error) {
      console.error('[relay] Error in agent exit listener:', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API: connection lifecycle
// ---------------------------------------------------------------------------

/**
 * Connect to the embedded relay broker.
 * Throws on failure — no silent error swallowing.
 */
export async function connect(): Promise<void> {
  if (relay && connected) {
    return;
  }

  const config = getRelayConfig();

  relay = new AgentRelay({ cwd: config.cwd });

  // Wire event hooks
  relay.onMessageReceived = (message) => {
    routeMessage(message.from, message.to, message.text, message.threadId, message.data);
  };

  relay.onAgentExited = (agent) => {
    handleAgentExited(agent);
  };

  relay.onAgentSpawned = (agent) => {
    agentHandles.set(agent.name, agent);
    console.log(`[relay] Agent spawned: ${agent.name}`);
  };

  humanHandle = relay.human({ name: 'PlannerCore' });

  connected = true;
  notifyStateChange('connected');

  console.log(`[relay] Connected (cwd: ${config.cwd})`);
}

/**
 * Disconnect from the relay broker.
 */
export async function disconnect(): Promise<void> {
  if (!relay) {
    return;
  }

  await relay.shutdown();
  connected = false;
  notifyStateChange('disconnected');

  console.log('[relay] Disconnected');
}

/**
 * Destroy the relay broker and null all references.
 */
export async function destroy(): Promise<void> {
  if (!relay) {
    return;
  }

  await relay.shutdown();

  relay = null;
  humanHandle = null;
  agentHandles.clear();
  connected = false;
  notifyStateChange('disconnected');

  console.log('[relay] Destroyed');
}

// ---------------------------------------------------------------------------
// Public API: state queries
// ---------------------------------------------------------------------------

export function isConnected(): boolean {
  return connected;
}

export function getConnectionState(): ConnectionState {
  return connected ? 'connected' : 'disconnected';
}

/**
 * Get the AgentRelay instance (replaces getClient()).
 * Returns null when not connected.
 */
export function getRelay(): AgentRelay | null {
  return relay;
}

/**
 * Get the Agent handle for a named agent.
 */
export function getAgentHandle(name: string): Agent | undefined {
  return agentHandles.get(name);
}

// ---------------------------------------------------------------------------
// Public API: messaging
// ---------------------------------------------------------------------------

/**
 * Send a direct message to an agent.
 * Throws if not connected.
 */
export async function sendMessage(
  to: string,
  body: string,
  _kind?: string,
  data?: Record<string, unknown>,
  _thread?: string
): Promise<void> {
  if (!humanHandle) {
    throw new Error('[relay] Cannot send message: not connected');
  }

  await humanHandle.sendMessage({ to, text: body, data });
}

/**
 * Send a message to a channel.
 * Throws if not connected.
 */
export async function sendChannelMessage(
  channel: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!humanHandle) {
    throw new Error(`[relay] Cannot send channel message to ${channel}: not connected`);
  }

  console.log(`[relay] sendChannelMessage: channel=${channel}, body="${body.substring(0, 50)}..."`);

  await humanHandle.sendMessage({ to: channel, text: body, data });
}

// ---------------------------------------------------------------------------
// Public API: subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscribe to connection state changes.
 * Returns unsubscribe function.
 */
export function onStateChange(callback: (state: ConnectionState) => void): () => void {
  stateChangeListeners.add(callback);
  return () => {
    stateChangeListeners.delete(callback);
  };
}

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
 * Register a handler for agent exit events.
 * Returns unsubscribe function.
 */
export function onAgentExited(callback: AgentExitHandler): () => void {
  agentExitListeners.add(callback);
  return () => {
    agentExitListeners.delete(callback);
  };
}

// ---------------------------------------------------------------------------
// MCP context builder
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API: agent lifecycle
// ---------------------------------------------------------------------------

/**
 * Spawn a new agent via the relay broker.
 * Throws on failure — no success/error wrapper.
 */
export async function spawnAgent(options: SpawnAgentOptions): Promise<SpawnResult> {
  if (!relay) {
    throw new Error('[relay] Cannot spawn agent: not connected');
  }

  const taskWithContext = options.skipMcpContext
    ? options.task
    : `${options.task}\n${buildMcpContext(options)}`;

  const channelId = options.planId ? `#plan-${options.planId}` : undefined;

  const channels: string[] = [];
  if (channelId) channels.push(channelId);
  if (options.channels) channels.push(...options.channels);

  const agent = await relay.spawn(
    options.name,
    options.cli || 'claude',
    taskWithContext,
    {
      channels: channels.length > 0 ? channels : undefined,
      model: options.model,
      cwd: options.cwd,
      team: options.team,
    }
  );

  agentHandles.set(agent.name, agent);

  console.log(`[relay] Spawned agent ${agent.name}${channelId ? ` (channel: ${channelId})` : ''}`);

  return { name: agent.name };
}

/**
 * Release (terminate) a spawned agent.
 * Throws if agent is not tracked.
 */
export async function releaseAgent(name: string): Promise<void> {
  const agent = agentHandles.get(name);
  if (!agent) {
    throw new Error(`[relay] Cannot release agent ${name}: not tracked`);
  }

  await agent.release();

  agentHandles.delete(name);
  emitAgentLeft(name, 'released');

  console.log(`[relay] Released agent ${name}`);
}

/**
 * Remove agent tracking — safe to call even if agent has already exited.
 * Does not throw if agent is not tracked.
 */
export async function removeAgent(name: string): Promise<void> {
  const agent = agentHandles.get(name);
  if (agent) {
    try {
      await agent.release();
    } catch (error) {
      console.log(`[relay] Agent ${name} release during cleanup: ${error instanceof Error ? error.message : error}`);
    }
  }

  agentHandles.delete(name);

  console.log(`[relay] Removed agent ${name} from tracking`);
}

/**
 * Set the model for a running spawned agent.
 * NOTE: AgentRelay 3.x does not expose setModel directly.
 * This is a known limitation of the 3.x migration.
 */
export async function setAgentModel(_name: string, _model: string): Promise<SetModelResult> {
  throw new Error('[relay] setAgentModel is not yet supported in the 3.x SDK migration');
}

// ---------------------------------------------------------------------------
// Public API: agent metadata queries
// ---------------------------------------------------------------------------

/**
 * Get list of currently tracked spawned agents.
 * channelId is derived from the agent's first channel membership.
 */
export function getSpawnedAgents(): Array<{ name: string; channelId?: string }> {
  return Array.from(agentHandles.entries()).map(([name, agent]) => ({
    name,
    channelId: agent.channels?.[0],
  }));
}

/**
 * Check if an agent is currently tracked as spawned.
 */
export function isAgentSpawned(name: string): boolean {
  return agentHandles.has(name);
}

/**
 * Get the plan channel associated with a spawned agent.
 * Returns undefined if the agent wasn't spawned with a plan context.
 */
export function getSpawnedAgentChannel(name: string): string | undefined {
  return agentHandles.get(name)?.channels?.[0];
}

export interface ConnectionMetrics {
  connected: boolean;
  trackedAgents: number;
  broker?: {
    agentCount: number;
    pendingDeliveries: number;
  };
  agents?: Array<{
    name: string;
    pid?: number;
  }>;
}

/**
 * Get connection metrics for health monitoring, including live broker and agent data
 * from the relay daemon's status endpoint.
 */
export async function getConnectionMetrics(): Promise<ConnectionMetrics> {
  const base: ConnectionMetrics = {
    connected,
    trackedAgents: agentHandles.size,
  };

  if (!relay || !connected) return base;

  try {
    const status = await relay.getStatus();

    base.broker = {
      agentCount: status.agent_count,
      pendingDeliveries: status.pending_delivery_count,
    };

    base.agents = status.agents.map((a) => ({
      name: a.name,
      pid: a.pid,
    }));
  } catch (error) {
    console.warn('[relay] Failed to fetch broker metrics:', error instanceof Error ? error.message : error);
  }

  return base;
}

// ---------------------------------------------------------------------------
// Public API: relay mode (formerly in service.ts)
// ---------------------------------------------------------------------------

export type RelayMode = ConnectionState;

/**
 * Get the current relay mode.
 */
export function getRelayMode(): RelayMode {
  return getConnectionState();
}

/**
 * Check if relay is available for use.
 */
export function isRelayAvailable(): boolean {
  return isConnected();
}
