/**
 * useActiveAgents - Hook for fetching and subscribing to active agents
 *
 * Features:
 * - Initial fetch via getActiveAgents API
 * - SSE subscription for agent_progress events
 * - Updates agent.last_message on progress events
 * - Removes agent from list on agent_exited event
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getActiveAgents } from '@/api/agents';
import { useRunEvents } from '@/hooks/useRunEvents';
import {
  AgentStatus,
  type ActiveAgent,
  type ForgeEventUnion,
} from '@/types';

interface UseActiveAgentsResult {
  agents: ActiveAgent[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useActiveAgents(runId: string | null | undefined): UseActiveAgentsResult {
  const [agents, setAgents] = useState<ActiveAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  // Fetch active agents
  const fetchAgents = useCallback(async () => {
    if (!runId) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getActiveAgents(runId);

      if (mountedRef.current) {
        setAgents(response.agents);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch agents'));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [runId]);

  // Handle SSE events
  const handleEvent = useCallback((event: ForgeEventUnion) => {
    if (!mountedRef.current) return;

    switch (event.type) {
      case 'agent_progress':
        // Update agent's last message
        setAgents((prev) => {
          const agentId = event.data.agent_id;
          const existingIndex = prev.findIndex((a) => a.agent_id === agentId);

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              last_message: event.data.message,
              last_heartbeat: event.data.timestamp || new Date().toISOString(),
            };
            return updated;
          }

          return prev;
        });
        break;

      case 'agent_exited':
        // Remove agent from list
        setAgents((prev) => {
          return prev.filter((a) => a.agent_id !== event.data.agent_id);
        });
        break;

      case 'agent_updated':
        // Update agent state
        setAgents((prev) => {
          const agentId = event.data.agent_id;
          const existingIndex = prev.findIndex((a) => a.agent_id === agentId);

          if (existingIndex >= 0) {
            const updated = [...prev];
            // Map AgentState to AgentStatus
            const status = mapStateToStatus(event.data.state);
            updated[existingIndex] = {
              ...updated[existingIndex],
              status,
              task_id: event.data.current_task_id || updated[existingIndex].task_id,
            };
            return updated;
          }

          return prev;
        });
        break;
    }
  }, []);

  // Subscribe to SSE events
  const { error: sseError } = useRunEvents(runId, {
    onEvent: handleEvent,
    enabled: !!runId && !isLoading,
  });

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchAgents();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchAgents]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    isLoading,
    error: error || sseError,
    refetch,
  };
}

/**
 * Map AgentState string to AgentStatus
 */
function mapStateToStatus(state: string): AgentStatus {
  switch (state.toLowerCase()) {
    case 'working':
      return AgentStatus.WORKING;
    case 'blocked':
    case 'waiting':
    case 'needs_input':
      return AgentStatus.BLOCKED;
    case 'error':
      return AgentStatus.ERROR;
    case 'idle':
    case 'offline':
    default:
      return AgentStatus.IDLE;
  }
}
