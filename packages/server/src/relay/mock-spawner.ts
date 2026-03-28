/**
 * Mock Planning Agent Spawner
 *
 * Provides mock agent behavior when relay is unavailable.
 * Useful for testing and development without relay-daemon.
 */

import { randomUUID } from 'crypto';
import type { SpawnContext, SpawnResult, Spawner } from './spawner.js';

export interface MockSpawnerConfig {
  /** Delay in ms before spawn completes (default: 100) */
  spawnDelayMs?: number;
  /** Delay in ms before terminate completes (default: 50) */
  terminateDelayMs?: number;
}

const activeAgents = new Set<string>();

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock spawner with configurable delays.
 */
export function createMockSpawner(config: MockSpawnerConfig = {}): Spawner {
  const spawnDelayMs = config.spawnDelayMs ?? 100;
  const terminateDelayMs = config.terminateDelayMs ?? 50;

  return {
    /**
     * Mock spawn - returns immediately with fake agent details.
     */
    async spawn(context: SpawnContext): Promise<SpawnResult> {
      // Simulate spawn delay
      if (spawnDelayMs > 0) {
        await sleep(spawnDelayMs);
      }

      const shortId = context.planId.slice(0, 8);
      const agentId = `mock-planner-${shortId}`;
      const sessionToken = `mock-session-${randomUUID()}`;

      activeAgents.add(agentId);

      console.log(`[mock-spawner] Created mock agent: ${agentId} for plan ${context.planId}`);

      return {
        agentId,
        sessionToken,
        isMock: true,
      };
    },

    /**
     * Mock terminate - removes agent from active set.
     */
    async terminate(agentId: string): Promise<void> {
      // Simulate terminate delay
      if (terminateDelayMs > 0) {
        await sleep(terminateDelayMs);
      }

      if (activeAgents.has(agentId)) {
        activeAgents.delete(agentId);
        console.log(`[mock-spawner] Terminated mock agent: ${agentId}`);
      } else {
        console.log(`[mock-spawner] Agent ${agentId} not found (may already be terminated)`);
      }
    },
  };
}

/**
 * Check if an agent ID is a mock agent.
 */
export function isMockAgent(agentId: string): boolean {
  return agentId.startsWith('mock-');
}

/**
 * Get list of active mock agents.
 */
export function getActiveMockAgents(): string[] {
  return Array.from(activeAgents);
}

/**
 * Clear all active mock agents (useful for testing).
 */
export function clearMockAgents(): void {
  activeAgents.clear();
}
