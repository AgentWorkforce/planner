/**
 * useAgentOrchestration Hook
 *
 * Manages agent orchestration state for the status bar and related components.
 * Provides:
 * - List of active agents with their states
 * - Pending questions count
 * - Resolved decisions count
 * - Session duration tracking
 *
 * Sources:
 * - /api/agents endpoint for initial state (merged presence + state)
 * - Relay for real-time updates (agent_joined, agent_left, agent_status_update)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRelay } from '@/contexts';
import { get } from '@/api/client';

export type AgentState = 'normal' | 'working' | 'needs_input' | 'idle' | 'error';

export type AgentRole =
  | 'architect'
  | 'ui-designer'
  | 'data-modeler'
  | 'coder'
  | 'tester'
  | 'security'
  | 'planner-lead';

export interface Agent {
  id: string;
  role: AgentRole;
  state: AgentState;
  displayName?: string;
  currentActivity?: string;
  currentStep?: string;
  currentThought?: string;
  hasQuestion: boolean;
}

export interface AgentOrchestrationState {
  agents: Agent[];
  pendingQuestions: number;
  resolvedDecisions: number;
  sessionDuration: number;
  isConnected: boolean;
}

export interface UseAgentOrchestrationResult extends AgentOrchestrationState {
  /** Refresh agent state from server */
  refresh: () => void;
  /** Get agent by ID */
  getAgent: (id: string) => Agent | undefined;
  /** Get agents needing input */
  getAgentsNeedingInput: () => Agent[];
  /** Get working agents */
  getWorkingAgents: () => Agent[];
}

/**
 * Hook for managing agent orchestration state.
 *
 * @param planId - Optional plan ID to scope agent state
 */
export function useAgentOrchestration(planId?: string): UseAgentOrchestrationResult {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState(0);
  const [resolvedDecisions, setResolvedDecisions] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);

  const sessionStartRef = useRef<number>(Date.now());
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use shared relay connection from context
  const { connection } = useRelay();
  const { isConnected, onMessage, onChannelMessage } = connection;

  // Session duration timer
  useEffect(() => {
    sessionStartRef.current = Date.now();

    durationIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setSessionDuration(elapsed);
    }, 1000);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Listen for agent status updates via relay
  useEffect(() => {
    if (!isConnected) return;

    // Handle direct messages (agent status updates)
    const unsubMessage = onMessage((msg) => {
      if (msg.data?.type === 'agents_snapshot') {
        const snapshot = msg.data as {
          type: string;
          agents: Array<{
            id: string;
            role: AgentRole;
            displayName?: string;
            state: AgentState;
          }>;
        };

        // Initialize agents map from snapshot
        setAgents(
          snapshot.agents.map((agent) => ({
            id: agent.id,
            role: agent.role,
            displayName: agent.displayName,
            state: agent.state,
            hasQuestion: agent.state === 'needs_input',
          }))
        );
      }

      if (msg.data?.type === 'agent_status_update') {
        const update = msg.data as {
          type: string;
          agentId: string;
          state: AgentState;
          activity?: string;
          step?: string;
          thought?: string;
        };

        setAgents((prev) => {
          const existing = prev.find((a) => a.id === update.agentId);
          if (existing) {
            return prev.map((a) =>
              a.id === update.agentId
                ? {
                    ...a,
                    state: update.state,
                    currentActivity: update.activity,
                    currentStep: update.step,
                    currentThought: update.thought,
                    hasQuestion: update.state === 'needs_input',
                  }
                : a
            );
          }
          return prev;
        });
      }

      if (msg.data?.type === 'agent_joined') {
        const joinEvent = msg.data as {
          type: string;
          agentId: string;
          role: AgentRole;
          displayName?: string;
          state?: AgentState;
        };

        setAgents((prev) => {
          // Don't add duplicates
          if (prev.find((a) => a.id === joinEvent.agentId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: joinEvent.agentId,
              role: joinEvent.role,
              displayName: joinEvent.displayName,
              state: joinEvent.state ?? 'idle',
              hasQuestion: false,
            },
          ];
        });
      }

      if (msg.data?.type === 'agent_left') {
        const leaveEvent = msg.data as {
          type: string;
          agentId: string;
        };

        setAgents((prev) => prev.filter((a) => a.id !== leaveEvent.agentId));
      }

      if (msg.data?.type === 'question_added') {
        setPendingQuestions((prev) => prev + 1);
      }

      if (msg.data?.type === 'question_answered') {
        setPendingQuestions((prev) => Math.max(0, prev - 1));
        setResolvedDecisions((prev) => prev + 1);
      }
    });

    // Handle channel messages (agent broadcasts)
    const unsubChannel = onChannelMessage((msg) => {
      if (msg.channel === `plan:${planId}:agents`) {
        // Handle plan-specific agent updates
        if (msg.data?.type === 'agents_snapshot') {
          const snapshot = msg.data as { agents: Agent[] };
          setAgents(snapshot.agents);
        }
      }
    });

    return () => {
      unsubMessage();
      unsubChannel();
    };
  }, [isConnected, onMessage, onChannelMessage, planId]);

  // Request agents snapshot on mount
  useEffect(() => {
    if (!isConnected) return;

    // Request current agent state from all agents
    connection.sendDirectMessage('*', 'request_agents_snapshot', { category: 'system' });
  }, [isConnected, connection]);

  // Fetch agents from API (merged presence + state)
  const fetchAgents = useCallback(async () => {
    try {
      interface AgentsResponse {
        agents: Array<{
          agentId: string;
          name: string;
          role?: AgentRole;
          displayName?: string;
          state: AgentState;
          activity?: string;
          thought?: string;
          isConnected: boolean;
        }>;
      }

      const data = await get<AgentsResponse>('/agents');

      setAgents(
        data.agents.map((agent) => ({
          id: agent.agentId,
          role: agent.role ?? 'coder',
          displayName: agent.displayName,
          state: agent.state,
          currentActivity: agent.activity,
          currentThought: agent.thought,
          hasQuestion: agent.state === 'needs_input',
        }))
      );
    } catch (error) {
      console.warn('[useAgentOrchestration] Error fetching agents:', error);
    }
  }, []);

  // Fetch on mount and when connection state changes
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents, isConnected]);

  // Refresh agent state (manual fetch)
  const refresh = useCallback(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Get agent by ID
  const getAgent = useCallback(
    (id: string) => agents.find((a) => a.id === id),
    [agents]
  );

  // Get agents needing input
  const getAgentsNeedingInput = useCallback(
    () => agents.filter((a) => a.state === 'needs_input'),
    [agents]
  );

  // Get working agents
  const getWorkingAgents = useCallback(
    () => agents.filter((a) => a.state === 'working'),
    [agents]
  );

  return {
    agents,
    pendingQuestions,
    resolvedDecisions,
    sessionDuration,
    isConnected,
    refresh,
    getAgent,
    getAgentsNeedingInput,
    getWorkingAgents,
  };
}
