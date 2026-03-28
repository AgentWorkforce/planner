/**
 * Agents API Module
 *
 * API functions for fetching active agents working on runs.
 */

import { get } from './client';
import type { ActiveAgent } from '@/types';

/**
 * Response type for getActiveAgents
 */
export interface GetActiveAgentsResponse {
  agents: ActiveAgent[];
}

/**
 * Get active agents, optionally filtered by run ID
 *
 * @param runId - Optional run ID to filter agents by
 * @returns Promise resolving to list of active agents
 */
export async function getActiveAgents(
  runId?: string
): Promise<GetActiveAgentsResponse> {
  const path = runId ? `/runs/${runId}/agents` : '/agents/active';
  return get<GetActiveAgentsResponse>(path);
}

/**
 * Get details for a specific agent
 *
 * @param agentId - The agent ID
 * @returns Promise resolving to agent details
 */
export async function getAgentDetails(agentId: string): Promise<ActiveAgent> {
  return get<ActiveAgent>(`/agents/${agentId}`);
}
