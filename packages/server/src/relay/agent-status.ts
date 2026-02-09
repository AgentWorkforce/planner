/**
 * Agent Status Events
 *
 * Provides standardized event types and helper functions for emitting
 * agent status updates via relay. Both persistent agents (like PlannerLead)
 * and spawned agents should use these to ensure consistent visibility
 * in the UI status bar.
 */

import { sendMessage } from './client.js';

// ============================================================================
// Browser Broadcast
// ============================================================================

/**
 * Optional direct-to-browser broadcast function.
 * Set by ws-proxy at startup to bypass relay for guaranteed delivery
 * to browser clients (relay broadcasts may not reach user-type clients).
 */
let browserBroadcast: ((message: Record<string, unknown>) => void) | null = null;

/**
 * Register a function that broadcasts messages directly to all browser
 * WebSocket connections. Called by ws-proxy during initialization.
 */
export function setBrowserBroadcast(fn: (message: Record<string, unknown>) => void): void {
  browserBroadcast = fn;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Agent state for status tracking.
 * - idle: Agent is connected but not actively working
 * - working: Agent is processing a task
 * - needs_input: Agent is waiting for user input (question pending)
 * - error: Agent encountered an error
 */
export type AgentState = 'idle' | 'working' | 'needs_input' | 'error';

/**
 * Agent roles for visual identification.
 * Maps to specific icons and labels in the UI.
 */
export type AgentRole =
  | 'planner-lead'
  | 'interviewer'
  | 'architect'
  | 'ui-designer'
  | 'data-modeler'
  | 'coder'
  | 'tester'
  | 'security';

/**
 * Event emitted when an agent joins the system.
 */
export interface AgentJoinedEvent {
  type: 'agent_joined';
  agentId: string;
  role: AgentRole;
  displayName: string;
  state: AgentState;
  timestamp: string;
}

/**
 * Event emitted when an agent's status changes.
 */
export interface AgentStatusUpdateEvent {
  type: 'agent_status_update';
  agentId: string;
  state: AgentState;
  activity?: string;
  step?: string;
  thought?: string;
  timestamp: string;
}

/**
 * Event emitted when an agent leaves the system.
 */
export interface AgentLeftEvent {
  type: 'agent_left';
  agentId: string;
  reason?: string;
  timestamp: string;
}

/**
 * Event emitted when sending a snapshot of all active agents.
 */
export interface AgentsSnapshotEvent {
  type: 'agents_snapshot';
  agents: Array<{
    agentId: string;
    role: AgentRole;
    displayName: string;
    state: AgentState;
  }>;
  timestamp: string;
}

/**
 * Union of all agent status event types.
 */
export type AgentStatusEvent =
  | AgentJoinedEvent
  | AgentStatusUpdateEvent
  | AgentLeftEvent
  | AgentsSnapshotEvent;

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * Internal registry of active agents.
 * Maps agentId -> agent metadata and current state.
 */
const activeAgents = new Map<string, { role: AgentRole; displayName: string; state: AgentState }>();

// ============================================================================
// Event Emitters
// ============================================================================

/**
 * Broadcast an event to all connected clients via two paths:
 * 1. Relay broadcast ('*') — reaches other relay agents
 * 2. Direct WebSocket push — guaranteed delivery to browser clients
 *    (relay broadcasts may not reach user-type clients)
 */
function broadcastEvent(event: AgentStatusEvent): void {
  // Path 1: relay broadcast for agents
  sendMessage('*', event.type, 'agent_status', event as unknown as Record<string, unknown>);

  // Path 2: direct push to browser WebSocket connections
  if (browserBroadcast) {
    browserBroadcast({
      type: 'message',
      from: 'agent-status',
      fromName: 'agent-status',
      entityType: 'agent',
      body: event.type,
      data: event as unknown as Record<string, unknown>,
      timestamp: Date.now(),
    });
  }
}

/**
 * Emit an agent_joined event when an agent becomes active.
 *
 * @param agentId - Unique identifier for this agent instance
 * @param role - The agent's role for visual identification
 * @param displayName - Human-readable name shown in UI
 */
export function emitAgentJoined(
  agentId: string,
  role: AgentRole,
  displayName: string
): void {
  // Add to registry
  activeAgents.set(agentId, { role, displayName, state: 'idle' });

  const event: AgentJoinedEvent = {
    type: 'agent_joined',
    agentId,
    role,
    displayName,
    state: 'idle',
    timestamp: new Date().toISOString(),
  };
  broadcastEvent(event);
}

/**
 * Emit an agent_status_update event when an agent's state changes.
 *
 * @param agentId - The agent's unique identifier
 * @param state - Current state of the agent
 * @param options - Optional additional status information
 */
export function emitAgentStatusUpdate(
  agentId: string,
  state: AgentState,
  options?: {
    activity?: string;
    step?: string;
    thought?: string;
  }
): void {
  // Update state in registry
  const agent = activeAgents.get(agentId);
  if (agent) {
    agent.state = state;
  }

  const event: AgentStatusUpdateEvent = {
    type: 'agent_status_update',
    agentId,
    state,
    ...(options?.activity && { activity: options.activity }),
    ...(options?.step && { step: options.step }),
    ...(options?.thought && { thought: options.thought }),
    timestamp: new Date().toISOString(),
  };
  broadcastEvent(event);
}

/**
 * Emit an agent_left event when an agent is shutting down.
 *
 * @param agentId - The agent's unique identifier
 * @param reason - Optional reason for leaving (e.g., 'shutdown', 'error', 'task_complete')
 */
export function emitAgentLeft(agentId: string, reason?: string): void {
  // Remove from registry
  activeAgents.delete(agentId);

  const event: AgentLeftEvent = {
    type: 'agent_left',
    agentId,
    ...(reason && { reason }),
    timestamp: new Date().toISOString(),
  };
  broadcastEvent(event);
}

/**
 * Emit a snapshot of all currently active agents.
 * Useful for newly connected clients to get current state.
 */
export function emitAgentsSnapshot(): void {
  const agents = Array.from(activeAgents.entries()).map(([agentId, metadata]) => ({
    agentId,
    ...metadata,
  }));

  const event: AgentsSnapshotEvent = {
    type: 'agents_snapshot',
    agents,
    timestamp: new Date().toISOString(),
  };
  broadcastEvent(event);
}

/**
 * Get the current registry state of all active agents.
 * Returns a snapshot of agent metadata indexed by agentId.
 */
export function getActiveAgents(): Map<string, { role: AgentRole; displayName: string; state: AgentState }> {
  return new Map(activeAgents);
}
