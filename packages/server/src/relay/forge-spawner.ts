/**
 * Forge Agent Spawner
 *
 * Wraps relay client spawn/release functions into forge-core's SpawnTaskFn interface.
 * This bridges the relay transport layer with forge's execution layer.
 */

import { spawnAgent, releaseAgent, isConnected, getClient } from './client.js';
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
 * Monitor a process by PID. Polls until the process exits, then fires the callback.
 * Uses kill(pid, 0) which sends no signal but checks if the process exists.
 */
function monitorPid(
  pid: number,
  onExited: (exitCode: number | null) => void,
  pollMs = 3000
): NodeJS.Timeout {
  const interval = setInterval(() => {
    try {
      process.kill(pid, 0); // Check if process exists (sends no signal)
    } catch {
      // Process is dead
      clearInterval(interval);
      // We can't get the real exit code from kill(pid, 0),
      // so we pass null — the orchestrator decides based on task state
      onExited(null);
    }
  }, pollMs);
  return interval;
}

/**
 * Spawn a task execution agent via relay daemon.
 * Maps SpawnTaskOptions → relay spawn options.
 * Optionally monitors the spawned PID and fires onExited when it dies.
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

  // Pre-spawn cleanup: release any stale agent with the same name.
  // Zombie agents from previous server sessions block name reuse in the relay daemon.
  try {
    const preRelease = await Promise.race([
      releaseAgent(agentName),
      new Promise<{ success: false }>(r => setTimeout(() => r({ success: false }), 2000)),
    ]);
    if (preRelease.success) {
      console.warn(`[forge-spawner] Cleared stale agent ${agentName} before respawn`);
      await new Promise(r => setTimeout(r, 500));
    } else {
      // Graceful release failed — try force-kill via CLI as fallback
      // This handles agents spawned by a previous server session
      const client = getClient();
      if (client) {
        try {
          await client.removeAgent(agentName, { removeMessages: true });
          console.warn(`[forge-spawner] Force-removed stale agent ${agentName} before respawn`);
          await new Promise(r => setTimeout(r, 500));
        } catch {
          // Agent likely doesn't exist — safe to proceed
        }
      }
    }
  } catch {
    // Best-effort — don't block spawn on cleanup failure
  }

  const result = await spawnAgent({
    name: agentName,
    cli,
    task,
    cwd: options.workspacePath || process.cwd(),
    skipMcpContext: true,
  });

  if (!result.success) {
    throw new Error(`Failed to spawn agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  const agentId = result.name || agentName;

  // Warn if PID is not available — timeout is the only safety net
  if (!result.pid) {
    console.warn(
      `[forge-spawner] WARNING: No PID returned for agent ${agentId} — timeout is the only safety net`
    );
  }

  // Monitor the agent process for exit if callback provided and PID available
  if (onExited && result.pid) {
    monitorPid(result.pid, (exitCode) => {
      console.log(`[forge-spawner] Agent ${agentId} (PID ${result.pid}) exited`);
      onExited({
        taskId: options.taskId,
        agentId,
        pid: result.pid!,
        exitCode,
      });

      // Deregister from relay registry on process exit (catches zombies that weren't released)
      const relayClient = getClient();
      if (relayClient) {
        relayClient.removeAgent(agentId, { removeMessages: true }).catch(() => {
          // Best-effort — agent may already be deregistered via releaseAgent path
        });
      }
    });
  }

  return {
    agentId,
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
    // Release failed — agent may have crashed. Still deregister from daemon registry
    // to prevent agents.json accumulation that causes daemon CPU spiral.
    console.error(`[forge-spawner] Failed to release agent ${agentId}: ${result.error || 'Unknown error'}`);
    const client = getClient();
    if (client) {
      try {
        await client.removeAgent(agentId, { removeMessages: true });
        console.log(`[forge-spawner] Deregistered dead agent ${agentId} from registry`);
      } catch {
        // Best-effort — agent may not exist in registry
      }
    }
  }
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

  // Pre-spawn cleanup: release any stale gate agent with the same name.
  try {
    const gatePreRelease = await Promise.race([
      releaseAgent(agentName),
      new Promise<{ success: false }>(r => setTimeout(() => r({ success: false }), 2000)),
    ]);
    if (gatePreRelease.success) {
      console.warn(`[forge-spawner] Cleared stale gate agent ${agentName} before respawn`);
      await new Promise(r => setTimeout(r, 500));
    }
  } catch {
    // Best-effort cleanup
  }

  const result = await spawnAgent({
    name: agentName,
    cli,
    task,
    cwd: options.cwd || process.cwd(),
    skipMcpContext: true,
  });

  if (!result.success) {
    throw new Error(`Failed to spawn gate agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  const agentId = result.name || agentName;

  console.log(`[forge-spawner] Spawned gate agent ${agentId} for gate ${options.gateId}`);

  // Warn if PID is not available — timeout is the only safety net
  if (!result.pid) {
    console.warn(
      `[forge-spawner] WARNING: No PID returned for gate agent ${agentId} — timeout is the only safety net`
    );
  }

  // Monitor the agent process for exit if callback provided and PID available
  if (onExited && result.pid) {
    monitorPid(result.pid, (exitCode) => {
      console.log(`[forge-spawner] Gate agent ${agentId} (PID ${result.pid}) exited`);
      onExited(exitCode);

      // Deregister gate agent from relay registry on exit
      const relayClient = getClient();
      if (relayClient) {
        relayClient.removeAgent(agentId, { removeMessages: true }).catch(() => {
          // Best-effort cleanup
        });
      }
    });
  }

  return {
    agentId,
    pid: result.pid,
  };
};

/**
 * Check if the forge spawner is available (relay connected).
 */
export function isForgeSpawnerAvailable(): boolean {
  return isConnected();
}
