/**
 * useAgentOrchestration Hook
 *
 * Manages agent orchestration state for the status bar.
 * Provides:
 * - List of active agents with their states
 * - Pending questions count
 * - Session duration tracking
 *
 * Note: Returns empty array for agents if no data available yet.
 * No mock data - real data only from project context.
 */

import { useState, useEffect, useRef } from 'react';
import { useRelayConnection } from './useRelayConnection';

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

export interface Question {
  question_id: string;
  agent_id: string;
  text: string;
  priority?: 'blocking' | 'normal' | 'fyi';
  created_at: string;
}

export interface AgentOrchestrationState {
  agents: Agent[];
  pendingQuestions: number;
  questions: Question[];
  sessionDuration: number;
  isConnected: boolean;
}

export interface UseAgentOrchestrationResult extends AgentOrchestrationState {
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);

  const sessionStartRef = useRef<number>(Date.now());
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use relay connection from hook
  const { state: connectionState, onMessage, onChannelMessage } = useRelayConnection();
  const isConnected = connectionState === 'connected';

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
        const questionEvent = msg.data as {
          type: string;
          question_id: string;
          agent_id: string;
          text: string;
          priority?: 'blocking' | 'normal' | 'fyi';
        };

        const newQuestion: Question = {
          question_id: questionEvent.question_id,
          agent_id: questionEvent.agent_id,
          text: questionEvent.text,
          priority: questionEvent.priority || 'normal',
          created_at: new Date().toISOString(),
        };

        setQuestions((prev) => {
          // Avoid duplicates
          if (prev.some((q) => q.question_id === newQuestion.question_id)) {
            return prev;
          }
          return [...prev, newQuestion];
        });

        setPendingQuestions((prev) => prev + 1);
      }

      if (msg.data?.type === 'question_answered') {
        const answerEvent = msg.data as {
          type: string;
          question_id: string;
        };

        setQuestions((prev) => prev.filter((q) => q.question_id !== answerEvent.question_id));
        setPendingQuestions((prev) => Math.max(0, prev - 1));
      }
    });

    // Handle channel messages (project-specific agent updates)
    const unsubChannel = onChannelMessage((msg) => {
      if (projectId && msg.channelId === `project:${projectId}:agents`) {
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
  }, [isConnected, onMessage, onChannelMessage, projectId]);

  // Get agent by ID
  const getAgent = (id: string) => agents.find((a) => a.id === id);

  // Get agents needing input
  const getAgentsNeedingInput = () => agents.filter((a) => a.state === 'needs_input');

  // Get working agents
  const getWorkingAgents = () => agents.filter((a) => a.state === 'working');

  return {
    agents,
    pendingQuestions,
    questions,
    sessionDuration,
    isConnected,
    getAgent,
    getAgentsNeedingInput,
    getWorkingAgents,
  };
}
