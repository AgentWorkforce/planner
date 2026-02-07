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
 * NOTE: This is a shell implementation. Full relay integration comes later.
 */

import { useState, useEffect, useRef } from 'react';

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
 * @param projectId - Optional project ID to scope agent state
 */
export function useAgentOrchestration(projectId?: string): UseAgentOrchestrationResult {
  const [agents] = useState<Agent[]>([]);
  const [pendingQuestions] = useState(0);
  const [resolvedDecisions] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);

  const sessionStartRef = useRef<number>(Date.now());
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // TODO: Add relay integration for real-time agent updates
  // TODO: Add API fetch for initial agent state
  // TODO: Add SSE subscription for agent status changes

  // Stub implementations
  const refresh = () => {
    // TODO: Fetch agents from API
    console.log('[useAgentOrchestration] refresh called (stub)', { projectId });
  };

  const getAgent = (id: string) => agents.find((a) => a.id === id);

  const getAgentsNeedingInput = () => agents.filter((a) => a.state === 'needs_input');

  const getWorkingAgents = () => agents.filter((a) => a.state === 'working');

  return {
    agents,
    pendingQuestions,
    resolvedDecisions,
    sessionDuration,
    isConnected: false, // TODO: Connect to relay
    refresh,
    getAgent,
    getAgentsNeedingInput,
    getWorkingAgents,
  };
}
