/**
 * PlannerLead Agent Auto-Spawn
 *
 * Manages the always-on PlannerLead agent that:
 * - Joins #planner and all #plan-{id} channels
 * - Responds to user questions about planning
 * - Can spawn specialist agents as needed
 *
 * The PlannerLead is spawned on server startup (if relay is available)
 * and rejoined to channels after reconnection.
 */

import { getClient, isConnected, onStateChange, type ClientState } from './client.js';
import { getRelayMode } from './service.js';
import { PLANNER_CHANNEL, getAllChannels } from './channels.js';
import { randomUUID } from 'crypto';

/** PlannerLead agent configuration */
const PLANNER_LEAD_CONFIG = {
  name: 'PlannerLead',
  cli: 'claude',
  displayName: 'Planning Assistant',
};

/** Track PlannerLead state */
let plannerLeadSpawned = false;
let plannerLeadAgentId: string | null = null;

/**
 * Get the PlannerLead task prompt.
 */
function getPlannerLeadPrompt(): string {
  return `You are PlannerLead, the always-on planning assistant for the Planner application.

## Your Role
- Monitor the #planner channel for general planning questions
- Monitor #plan-{id} channels for plan-specific discussions
- Help users understand and refine their plans
- Answer questions about planning best practices
- Suggest improvements when asked

## Channels
You are a member of these channels:
- #planner: Global planning discussions
- #plan-*: Per-plan channels for specific plan discussions

## Behavior Guidelines
1. Be helpful and concise
2. When asked about a specific plan, use the MCP tools to read the plan first
3. Suggest concrete improvements with clear reasoning
4. Don't make changes without being asked - suggest and confirm first
5. If a user needs specialized help (dependency analysis, scope review),
   mention that you can spawn a specialist agent

## Available MCP Tools
You have access to planning tools via MCP:
- read_plan: Read a plan's current state
- add_step: Add a new step to a plan
- edit_step: Modify an existing step
- remove_step: Remove a step from a plan
- set_dependencies: Update step dependencies
- set_acceptance_criteria: Update acceptance criteria

## Starting Up
1. Join the #planner channel
2. Post a brief "online" message: "PlannerLead online. Ready to help with your plans!"
3. Wait for messages and respond to them

Begin by joining #planner and announcing your availability.`;
}

/**
 * Spawn the PlannerLead agent.
 */
export async function spawnPlannerLead(): Promise<boolean> {
  if (plannerLeadSpawned) {
    console.log('[planner-lead] PlannerLead already spawned');
    return true;
  }

  const client = getClient();
  if (!client || !isConnected()) {
    console.log('[planner-lead] Cannot spawn: relay not connected');
    return false;
  }

  try {
    const result = await client.spawn({
      name: PLANNER_LEAD_CONFIG.name,
      cli: PLANNER_LEAD_CONFIG.cli,
      task: getPlannerLeadPrompt(),
      cwd: process.cwd(),
    });

    plannerLeadSpawned = true;
    plannerLeadAgentId = result.name || PLANNER_LEAD_CONFIG.name;

    console.log(`[planner-lead] Spawned PlannerLead agent: ${plannerLeadAgentId}`);

    // Join all existing channels
    setTimeout(() => joinPlannerLeadToChannels(), 2000);

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[planner-lead] Failed to spawn PlannerLead: ${message}`);
    plannerLeadSpawned = false;
    return false;
  }
}

/**
 * Join PlannerLead to all channels.
 */
function joinPlannerLeadToChannels(): void {
  const client = getClient();
  if (!client || !isConnected()) {
    return;
  }

  // Join #planner
  client.adminJoinChannel(PLANNER_CHANNEL, PLANNER_LEAD_CONFIG.name);
  console.log(`[planner-lead] Joined ${PLANNER_LEAD_CONFIG.name} to ${PLANNER_CHANNEL}`);

  // Join all plan channels
  const channels = getAllChannels();
  for (const channelId of channels) {
    if (channelId !== PLANNER_CHANNEL) {
      client.adminJoinChannel(channelId, PLANNER_LEAD_CONFIG.name);
      console.log(`[planner-lead] Joined ${PLANNER_LEAD_CONFIG.name} to ${channelId}`);
    }
  }
}

/**
 * Join PlannerLead to a new channel.
 * Call this when a new plan channel is created.
 */
export function joinPlannerLeadToChannel(channelId: string): void {
  if (!plannerLeadSpawned) {
    console.log('[planner-lead] Cannot join channel: PlannerLead not spawned');
    return;
  }

  const client = getClient();
  if (!client || !isConnected()) {
    return;
  }

  client.adminJoinChannel(channelId, PLANNER_LEAD_CONFIG.name);
  console.log(`[planner-lead] Joined ${PLANNER_LEAD_CONFIG.name} to ${channelId}`);
}

/**
 * Terminate the PlannerLead agent.
 */
export async function terminatePlannerLead(): Promise<void> {
  if (!plannerLeadSpawned || !plannerLeadAgentId) {
    return;
  }

  const client = getClient();
  if (!client || !isConnected()) {
    plannerLeadSpawned = false;
    plannerLeadAgentId = null;
    return;
  }

  try {
    await client.release(plannerLeadAgentId);
    console.log(`[planner-lead] Terminated PlannerLead agent: ${plannerLeadAgentId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[planner-lead] Error terminating PlannerLead: ${message}`);
  }

  plannerLeadSpawned = false;
  plannerLeadAgentId = null;
}

/**
 * Check if PlannerLead is currently active.
 */
export function isPlannerLeadActive(): boolean {
  return plannerLeadSpawned;
}

/**
 * Get the PlannerLead agent ID.
 */
export function getPlannerLeadAgentId(): string | null {
  return plannerLeadAgentId;
}

/**
 * Initialize PlannerLead management.
 * Spawns PlannerLead when relay is available.
 */
export function initPlannerLead(): void {
  // Try to spawn now if connected
  if (getRelayMode() === 'connected') {
    spawnPlannerLead();
  }

  // Also spawn when connection becomes ready
  onStateChange((state: ClientState) => {
    if (state === 'READY' && !plannerLeadSpawned) {
      spawnPlannerLead();
    } else if (state === 'DISCONNECTED') {
      // Mark as not spawned on disconnect (will respawn on reconnect)
      plannerLeadSpawned = false;
      plannerLeadAgentId = null;
    }
  });

  console.log('[planner-lead] PlannerLead management initialized');
}
