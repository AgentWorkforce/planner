/**
 * Planning Agent Spawner
 *
 * Spawns Claude instances via relay-daemon for AI-assisted planning.
 */

import { getClient, isConnected } from './client.js';
import { getPlanningAgentPrompt } from './prompts/planning-agent.js';
import { getRevisionAgentPrompt } from './prompts/revision-agent.js';
import { randomUUID } from 'crypto';
import type { ChangeRequest } from '../domain/change-request.js';

export interface SpawnContext {
  /** Plan ID the agent will work on */
  planId: string;
  /** The goal/objective for the plan */
  goal: string;
  /** Additional context (attachments, constraints) */
  context?: string;
  /** MCP server URL for agent to connect back */
  mcpServerUrl?: string;
  /** Number of existing steps in the plan (for continuing work on existing plans) */
  existingStepCount?: number;
}

export interface SpawnResult {
  /** Unique agent identifier */
  agentId: string;
  /** Session token for MCP authentication */
  sessionToken: string;
  /** Whether this is a mock agent */
  isMock: boolean;
}

export interface RevisionContext {
  /** Plan ID the agent will work on */
  planId: string;
  /** The change request to address */
  changeRequest: ChangeRequest;
  /** Current version number to base revision on */
  currentVersion: number;
  /** MCP server URL for agent to connect back */
  mcpServerUrl?: string;
}

export interface Spawner {
  spawn(context: SpawnContext): Promise<SpawnResult>;
  spawnRevision?(context: RevisionContext): Promise<SpawnResult>;
  terminate(agentId: string): Promise<void>;
}

/**
 * Generate a unique agent name for a plan.
 */
function generateAgentName(planId: string): string {
  const shortId = planId.slice(0, 8);
  return `Planner-${shortId}`;
}

/**
 * Generate a unique agent name for a revision agent.
 */
function generateRevisionAgentName(changeRequestId: string): string {
  const shortId = changeRequestId.slice(0, 8);
  return `Reviser-${shortId}`;
}

/**
 * Generate a session token for MCP authentication.
 */
function generateSessionToken(): string {
  return randomUUID();
}

/**
 * Build the initial task prompt for the agent.
 */
function buildInitialTask(context: SpawnContext, sessionToken: string): string {
  const hasExistingSteps = context.existingStepCount && context.existingStepCount > 0;

  let task = `You are starting work on plan "${context.planId}".

## Goal
${context.goal}
`;

  if (context.context) {
    task += `
## Additional Context
${context.context}
`;
  }

  // Include existing plan state info
  if (hasExistingSteps) {
    task += `
## Existing Plan State
This plan already has ${context.existingStepCount} steps. You are continuing work on an existing plan, not starting from scratch.
`;
  }

  // Include MCP connection details
  if (context.mcpServerUrl) {
    task += `
## MCP Connection
Connect to the planning MCP server to use planning tools:
- Server URL: ${context.mcpServerUrl}
- Session Token: ${sessionToken}
- Plan ID: ${context.planId}

Add these headers to all MCP requests:
- X-Session-Token: ${sessionToken}
- X-Plan-ID: ${context.planId}
`;
  }

  // Adjust instructions based on whether this is a new or existing plan
  if (hasExistingSteps) {
    task += `
## Instructions
1. First, use \`read_plan\` to see the current state of the plan
2. Send a brief greeting to the human: "Hi! I've connected to your plan. Let me take a quick look at what you have so far..."
3. After reading, summarize what you see (number of steps, scopes, any obvious gaps)
4. Ask the human what they'd like help with - refining steps, adding new steps, or reviewing the plan
5. Wait for their response before making changes

**Important**: The human may send you a chat message at any time. Always respond promptly - they can see when you're connected and expect quick replies.

Begin by reading the plan, then greet the human with a summary.`;
  } else {
    task += `
## Instructions
1. First, use \`read_plan\` to see the current state of the plan (it may be empty)
2. Send a greeting to the human: "Hi! I'm ready to help you build out this plan. Let me understand what we're working with..."
3. After reading, acknowledge what you see and offer to help structure the plan
4. Ask if they'd like you to suggest an initial structure, or if they have specific steps in mind
5. Wait for their response before adding steps

**Important**: The human may send you a chat message at any time. Always respond promptly - they can see when you're connected and expect quick replies. Don't start adding steps until you've checked in with them.

Begin by reading the plan, then greet the human and ask how they'd like to proceed.`;
  }

  return task;
}

/**
 * Build the initial task prompt for the revision agent.
 */
function buildRevisionTask(context: RevisionContext, sessionToken: string): string {
  const { changeRequest, planId, currentVersion } = context;

  let task = `You are starting a revision task for plan "${planId}".

## Change Request

You need to address the following change request from the Orchestrator:

**Change Request ID:** ${changeRequest.change_request_id}
**Run ID:** ${changeRequest.run_id}
**Reason:** ${changeRequest.reason}

### Suggested Changes from Orchestrator
`;

  // Format suggested changes
  const changes = changeRequest.suggested_changes;
  if (changes.add_steps && changes.add_steps.length > 0) {
    task += `\n**Add Steps:**\n`;
    for (const step of changes.add_steps) {
      task += `- ${step.title}${step.description ? `: ${step.description}` : ''}\n`;
    }
  }

  if (changes.modify_steps && changes.modify_steps.length > 0) {
    task += `\n**Modify Steps:**\n`;
    for (const mod of changes.modify_steps) {
      task += `- Step ${mod.step_id}:`;
      if (mod.title) task += ` title → "${mod.title}"`;
      if (mod.description) task += ` description → "${mod.description}"`;
      if (mod.dependencies) task += ` dependencies → [${mod.dependencies.join(', ')}]`;
      task += '\n';
    }
  }

  if (changes.remove_steps && changes.remove_steps.length > 0) {
    task += `\n**Remove Steps:** ${changes.remove_steps.join(', ')}\n`;
  }

  task += `
## Current Version

Base your revision on version ${currentVersion} of the plan.
`;

  // Include MCP connection details
  if (context.mcpServerUrl) {
    task += `
## MCP Connection

Connect to the planning MCP server to use planning tools:
- Server URL: ${context.mcpServerUrl}
- Session Token: ${sessionToken}
- Plan ID: ${planId}

Add these headers to all MCP requests:
- X-Session-Token: ${sessionToken}
- X-Plan-ID: ${planId}
`;
  }

  task += `
## Instructions

1. First, use \`read_plan\` to see the current state of the plan
2. Analyze the change request reason and the Orchestrator's suggested changes
3. Determine the minimal set of changes needed to address the issue
4. Apply your changes using the MCP tools (add_step, edit_step, remove_step, set_dependencies)
5. Verify your changes address the original issue
6. Summarize what you changed and why

**Important:** Make only the changes necessary to address this change request. Do not restructure the entire plan or add unrelated improvements.

Begin by reading the plan to understand its current state.`;

  return task;
}

/**
 * Spawn a planning agent via relay-daemon.
 */
export async function spawnPlanningAgent(context: SpawnContext): Promise<SpawnResult> {
  const client = getClient();

  if (!client || !isConnected()) {
    throw new Error('Relay client not connected');
  }

  const agentName = generateAgentName(context.planId);
  const sessionToken = generateSessionToken();
  const task = buildInitialTask(context, sessionToken);

  try {
    // Spawn the agent via relay
    const result = await client.spawn({
      name: agentName,
      cli: 'claude',
      task,
      cwd: process.cwd(),
    });

    console.log(`[spawner] Spawned planning agent: ${agentName} (${result.name})`);

    return {
      agentId: result.name || agentName,
      sessionToken,
      isMock: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[spawner] Failed to spawn planning agent: ${message}`);
    throw error;
  }
}

/**
 * Spawn a revision agent via relay-daemon to handle a change request.
 */
export async function spawnRevisionAgent(context: RevisionContext): Promise<SpawnResult> {
  const client = getClient();

  if (!client || !isConnected()) {
    throw new Error('Relay client not connected');
  }

  const agentName = generateRevisionAgentName(context.changeRequest.change_request_id);
  const sessionToken = generateSessionToken();
  const task = buildRevisionTask(context, sessionToken);

  try {
    // Spawn the agent via relay
    const result = await client.spawn({
      name: agentName,
      cli: 'claude',
      task,
      cwd: process.cwd(),
    });

    console.log(
      `[spawner] Spawned revision agent: ${agentName} (${result.name}) for change request ${context.changeRequest.change_request_id}`
    );

    return {
      agentId: result.name || agentName,
      sessionToken,
      isMock: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[spawner] Failed to spawn revision agent: ${message}`);
    throw error;
  }
}

/**
 * Terminate a planning agent.
 */
export async function terminateAgent(agentId: string): Promise<void> {
  const client = getClient();

  if (!client || !isConnected()) {
    console.log(`[spawner] Cannot terminate ${agentId}: relay not connected`);
    return;
  }

  try {
    await client.release(agentId);
    console.log(`[spawner] Terminated agent: ${agentId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Don't throw on termination errors - might already be terminated
    console.error(`[spawner] Error terminating agent ${agentId}: ${message}`);
  }
}

/**
 * Create a spawner instance.
 */
export function createSpawner(): Spawner {
  return {
    spawn: spawnPlanningAgent,
    spawnRevision: spawnRevisionAgent,
    terminate: terminateAgent,
  };
}

// Re-export types and prompts
export { getPlanningAgentPrompt } from './prompts/planning-agent.js';
export { getRevisionAgentPrompt } from './prompts/revision-agent.js';
