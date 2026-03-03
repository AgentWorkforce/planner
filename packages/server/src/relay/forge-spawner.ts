/**
 * Forge Agent Spawner
 *
 * Wraps relay client spawn/release functions into forge-core's SpawnTaskFn interface.
 * This bridges the relay transport layer with forge's execution layer.
 */

import { spawnAgent, removeAgent, getAgentHandle, isConnected, isAgentSpawned } from './client.js';
import { buildTaskPrompt, buildGateAgentPrompt } from '../../../forge-core/src/prompts/index.js';
import { resolveModelId } from '../../../forge-core/src/config/forge-config.js';
import type {
  SpawnTaskFn,
  SpawnTaskOptions,
  SpawnTaskResult,
  OnAgentExitedFn,
  SpawnGateAgentFn,
  SpawnGateOptions,
  SpawnGateResult,
} from '../../../forge-core/src/services/agent-spawner.js';
import type { TerminateAgentFn } from '../../../forge-core/src/services/recovery.js';

/**
 * Spawn a task execution agent via relay daemon.
 * Maps SpawnTaskOptions → relay spawn options.
 * Registers an exit listener via Agent.waitForExit() when onExited is provided.
 */
export const spawnForgeTask: SpawnTaskFn = async (
  options: SpawnTaskOptions,
  onExited?: OnAgentExitedFn
): Promise<SpawnTaskResult> => {
  const agentName = `Worker-${options.taskId.slice(0, 8)}`;
  const task = buildTaskPrompt(options);

  // If model is specified, append --model flag to CLI
  let cli = options.cli;
  if (options.model) {
    cli = `${cli} --model ${resolveModelId(options.model)}`;
  }

  // Pre-spawn cleanup: remove any stale agent with the same name.
  // Zombie agents from previous server sessions block name reuse in the relay daemon.
  if (isAgentSpawned(agentName)) {
    await removeAgent(agentName);
    console.log(`[forge-spawner] Cleared stale agent ${agentName} before respawn`);
  }

  const result = await spawnAgent({
    name: agentName,
    cli,
    task,
    cwd: options.workspacePath || process.cwd(),
    skipMcpContext: true,
  });

  const agentId = result.name;

  // Register exit listener via Agent lifecycle event
  if (onExited) {
    const agent = getAgentHandle(agentId);
    if (agent) {
      agent.waitForExit().then(() => {
        console.log(`[forge-spawner] Agent ${agentId} exited`);
        onExited({
          taskId: options.taskId,
          agentId,
          pid: 0, // PID no longer available from agent lifecycle events
          exitCode: agent.exitCode ?? null,
        });
        removeAgent(agentId).catch(() => {
          // Best-effort — agent may already be deregistered
        });
      });
    } else {
      console.warn(`[forge-spawner] Could not get handle for agent ${agentId} — exit will not be detected`);
    }
  }

  return {
    agentId,
    pid: undefined,
  };
};

/**
 * Terminate a forge task agent via relay daemon.
 * Maps agentId → relay remove (handles release + cleanup, does not throw if already gone).
 */
export const terminateForgeAgent: TerminateAgentFn = async (agentId: string): Promise<void> => {
  await removeAgent(agentId);
};

/**
 * Spawn a quality gate analysis agent via relay daemon.
 * These are lighter-weight agents that perform analysis and report findings via MCP.
 */
export const spawnGateAgent: SpawnGateAgentFn = async (
  options: SpawnGateOptions,
  onExited?: (exitCode: number | null) => void
): Promise<SpawnGateResult> => {
  const agentName = `Gate-${options.gateId.slice(0, 8)}`;
  const task = buildGateAgentPrompt(options.gateId, options.prompt);

  // Build CLI: model + max-turns limit.
  // Gate agents must complete within a few turns — they analyze the prompt context,
  // optionally do one quick file lookup, then write findings to file and exit.
  // Without --max-turns, agents exhaust their session budget on extensive analysis
  // and never reach the file-writing step (100% timeout observed).
  let cli = options.cli || 'claude';
  if (options.model) {
    cli = `${cli} --model ${resolveModelId(options.model)}`;
  }
  cli += ' --max-turns 3';

  // Pre-spawn cleanup: remove any stale gate agent with the same name.
  if (isAgentSpawned(agentName)) {
    await removeAgent(agentName);
    console.log(`[forge-spawner] Cleared stale gate agent ${agentName} before respawn`);
  }

  const result = await spawnAgent({
    name: agentName,
    cli,
    task,
    cwd: options.cwd || process.cwd(),
    skipMcpContext: true,
  });

  const agentId = result.name;

  console.log(`[forge-spawner] Spawned gate agent ${agentId} for gate ${options.gateId}`);

  // Register exit listener via Agent lifecycle event
  if (onExited) {
    const agent = getAgentHandle(agentId);
    if (agent) {
      agent.waitForExit().then(() => {
        console.log(`[forge-spawner] Gate agent ${agentId} exited`);
        onExited(agent.exitCode ?? null);
        removeAgent(agentId).catch(() => {
          // Best-effort — agent may already be deregistered
        });
      });
    } else {
      console.warn(`[forge-spawner] Could not get handle for gate agent ${agentId} — exit will not be detected`);
    }
  }

  return {
    agentId,
    pid: undefined,
  };
};

/**
 * Check if the forge spawner is available (relay connected).
 */
export function isForgeSpawnerAvailable(): boolean {
  return isConnected();
}
