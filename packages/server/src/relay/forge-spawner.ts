/**
 * Forge Agent Spawner
 *
 * Wraps relay client spawn/release functions into forge-core's SpawnTaskFn interface.
 * This bridges the relay transport layer with forge's execution layer.
 */

import { spawnAgent, releaseAgent, isConnected } from './client.js';
import type {
  SpawnTaskFn,
  SpawnTaskOptions,
  SpawnTaskResult,
} from '../../../forge-core/src/services/agent-spawner.js';
import type { TerminateAgentFn } from '../../../forge-core/src/services/recovery.js';

/**
 * Build execution prompt from step details.
 * Keeps prompt simple — advanced prompt engineering is a separate concern.
 */
function buildTaskPrompt(options: SpawnTaskOptions): string {
  let prompt = `You are executing a task from a Forge orchestration run.

## Task Details

**Task ID:** ${options.taskId}
**Run ID:** ${options.runId}
**Step Title:** ${options.stepTitle}
`;

  if (options.stepDescription) {
    prompt += `
**Description:**
${options.stepDescription}
`;
  }

  if (options.scope) {
    prompt += `
**Scope:** ${options.scope}
`;
  }

  if (options.ownerRole) {
    prompt += `
**Role:** ${options.ownerRole}
`;
  }

  if (options.acceptanceCriteria && options.acceptanceCriteria.length > 0) {
    prompt += `
## Acceptance Criteria

`;
    for (const criterion of options.acceptanceCriteria) {
      const type = criterion.type ? ` (${criterion.type})` : '';
      prompt += `- ${criterion.description}${type}\n`;
    }
  }

  prompt += `
## Instructions

1. Understand the task and acceptance criteria
2. Execute the required work
3. Verify acceptance criteria are met
4. Report status via MCP tools (report_agent_status)
5. If you need clarification, use ask_user_question (NOT your terminal!)

**Important:** You are part of an orchestrated workflow. Focus on your specific task and acceptance criteria. Do not attempt to modify the overall plan or execute other tasks.

Begin by acknowledging the task and outlining your approach.`;

  return prompt;
}

/**
 * Spawn a task execution agent via relay daemon.
 * Maps SpawnTaskOptions → relay spawn options.
 */
export const spawnForgeTask: SpawnTaskFn = async (options: SpawnTaskOptions): Promise<SpawnTaskResult> => {
  const agentName = `Worker-${options.taskId.slice(0, 8)}`;
  const task = buildTaskPrompt(options);

  const result = await spawnAgent({
    name: agentName,
    cli: options.cli,
    task,
    cwd: options.workspacePath || process.cwd(),
    // TODO: Add planId when available in SpawnTaskOptions (for channel join + MCP context)
  });

  if (!result.success) {
    throw new Error(`Failed to spawn agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  return {
    agentId: result.name || agentName,
    pid: result.pid,
  };
};

/**
 * Terminate a forge task agent via relay daemon.
 * Maps agentId → relay release.
 */
export const terminateForgeAgent: TerminateAgentFn = async (agentId: string): Promise<void> => {
  const result = await releaseAgent(agentId);

  if (!result.success) {
    // Log but don't throw — agent might already be terminated
    console.error(`[forge-spawner] Failed to release agent ${agentId}: ${result.error || 'Unknown error'}`);
  }
};

/**
 * Check if the forge spawner is available (relay connected).
 */
export function isForgeSpawnerAvailable(): boolean {
  return isConnected();
}
