/**
 * useAgentOrchestration Hook
 *
 * Server-authoritative agent presence and state management.
 *
 * Architecture:
 * - GET /api/agents is the single source of truth
 * - Fetched on mount, on reconnect, and every RECONCILE_INTERVAL_MS
 * - Relay events (agent_status_update, agent_joined, agent_left) provide
 *   real-time responsiveness between polls
 * - Reconciliation: server wins — stale local entries are pruned,
 *   missing server entries are added
 *
 * No placeholders, no guessing. If an agent hasn't connected, it doesn't appear.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRelayConnection } from './useRelayConnection';

export type AgentState = 'idle' | 'working' | 'needs_input' | 'error';

export type AgentRole =
  | 'interviewer'
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
  lifecycleState?: 'active' | 'grace_period' | 'draining' | 'warming' | 'parked';
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

/** Reconciliation interval — how often we re-fetch /api/agents to prune stale entries */
const RECONCILE_INTERVAL_MS = 15_000;

/** Infer agent role from its ID. */
function inferRoleFromId(agentId: string): AgentRole {
  const id = agentId.toLowerCase();
  if (id.includes('interviewer')) return 'interviewer';
  if (id.includes('planner') || id.includes('pln')) return 'planner-lead';
  if (id.includes('architect')) return 'architect';
  if (id.includes('designer') || id.includes('uid')) return 'ui-designer';
  if (id.includes('data') || id.includes('model')) return 'data-modeler';
  if (id.includes('test')) return 'tester';
  if (id.includes('security') || id.includes('sec')) return 'security';
  return 'coder';
}

/** API response shape from GET /api/agents */
interface AgentApiResponse {
  agents: Array<{
    agentId: string;
    name: string;
    role?: AgentRole;
    displayName?: string;
    state: AgentState;
    lifecycleState?: 'active' | 'grace_period' | 'draining' | 'warming' | 'parked';
    activity?: string;
    thought?: string;
    isConnected: boolean;
  }>;
  mode: string;
}

/**
 * Fetch the authoritative agent list from the server.
 * Returns null on failure (network error, server down).
 */
async function fetchAgentsFromServer(): Promise<AgentApiResponse | null> {
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Convert an API agent to our local Agent shape.
 */
function apiAgentToLocal(apiAgent: AgentApiResponse['agents'][number]): Agent {
  return {
    id: apiAgent.agentId,
    role: apiAgent.role ?? inferRoleFromId(apiAgent.agentId),
    state: apiAgent.state,
    lifecycleState: apiAgent.lifecycleState,
    displayName: apiAgent.displayName,
    currentActivity: apiAgent.activity,
    currentThought: apiAgent.thought,
    hasQuestion: apiAgent.state === 'needs_input',
  };
}

/**
 * Reconcile server agent list with local state.
 * Server is authority: prunes agents not in server list, adds missing ones.
 * Preserves local real-time state (activity, thought) when server data is stale.
 */
function reconcileAgents(local: Agent[], server: Agent[]): Agent[] {
  const serverIds = new Set(server.map((a) => a.id));
  const localMap = new Map(local.map((a) => [a.id, a]));

  const result: Agent[] = [];

  // For each server agent: use server data, but preserve richer local state
  for (const serverAgent of server) {
    const localAgent = localMap.get(serverAgent.id);
    if (localAgent) {
      // Merge: keep local real-time fields if they're richer than server snapshot
      result.push({
        ...serverAgent,
        currentActivity: localAgent.currentActivity ?? serverAgent.currentActivity,
        currentStep: localAgent.currentStep ?? serverAgent.currentStep,
        currentThought: localAgent.currentThought ?? serverAgent.currentThought,
        // Use local state if it's more specific (e.g., 'working' vs server's 'idle'
        // due to poll timing). But if server says agent is gone, trust that.
        state: localAgent.state,
        lifecycleState: serverAgent.lifecycleState ?? localAgent.lifecycleState,
        hasQuestion: localAgent.hasQuestion,
      });
    } else {
      // New agent from server — add it
      result.push(serverAgent);
    }
  }

  // Agents in local but NOT in server are stale — drop them.
  // (This is the key cleanup: crashed agents, missed agent_left events, ghosts.)
  for (const localAgent of local) {
    if (!serverIds.has(localAgent.id)) {
      // Stale — don't include
    }
  }

  return result;
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

  // Ref to current agents for use in reconciliation without stale closures
  const agentsRef = useRef<Agent[]>([]);
  agentsRef.current = agents;

  // ── Fetch & reconcile ────────────────────────────────────────────────

  const reconcileFromServer = useCallback(async () => {
    const response = await fetchAgentsFromServer();
    if (!response) return;

    const serverAgents = response.agents.map(apiAgentToLocal);

    setAgents((prev) => reconcileAgents(prev, serverAgents));
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    reconcileFromServer();
  }, [reconcileFromServer]);

  // Re-fetch on reconnect
  const prevConnectedRef = useRef(isConnected);
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      // Just reconnected — fetch fresh state
      reconcileFromServer();
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, reconcileFromServer]);

  // Periodic reconciliation
  useEffect(() => {
    const interval = setInterval(reconcileFromServer, RECONCILE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reconcileFromServer]);

  // ── Session duration timer ───────────────────────────────────────────

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

  // ── Real-time relay events ───────────────────────────────────────────

  useEffect(() => {
    if (!isConnected) return;

    const unsubMessage = onMessage((msg) => {
      // Snapshot: full replacement from server (e.g., on connection)
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

      // Status update: update existing or add new agent
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
          // Unknown agent sent a status update — add it.
          // Reconciliation will confirm or prune within RECONCILE_INTERVAL_MS.
          return [
            ...prev,
            {
              id: update.agentId,
              role: inferRoleFromId(update.agentId),
              state: update.state,
              currentActivity: update.activity,
              currentStep: update.step,
              currentThought: update.thought,
              hasQuestion: update.state === 'needs_input',
            },
          ];
        });
      }

      // Agent joined
      if (msg.data?.type === 'agent_joined') {
        const joinEvent = msg.data as {
          type: string;
          agentId: string;
          role: AgentRole;
          displayName?: string;
          state?: AgentState;
        };

        setAgents((prev) => {
          const existing = prev.find((a) => a.id === joinEvent.agentId);
          if (existing) {
            // Agent was warming and now fully joined — reset to active
            if (existing.lifecycleState === 'warming') {
              return prev.map((a) =>
                a.id === joinEvent.agentId
                  ? {
                      ...a,
                      lifecycleState: 'active',
                      state: joinEvent.state ?? a.state,
                    }
                  : a
              );
            }
            return prev;
          }
          return [
            ...prev,
            {
              id: joinEvent.agentId,
              role: joinEvent.role,
              displayName: joinEvent.displayName,
              state: joinEvent.state ?? 'idle',
              lifecycleState: 'active',
              hasQuestion: false,
            },
          ];
        });
      }

      // Agent left
      if (msg.data?.type === 'agent_left') {
        const leaveEvent = msg.data as {
          type: string;
          agentId: string;
        };

        setAgents((prev) => prev.filter((a) => a.id !== leaveEvent.agentId));
      }

      // Agent parked (released due to no users connected)
      if (msg.data?.type === 'agent_parked') {
        const parkEvent = msg.data as {
          type: string;
          agentId: string;
        };

        // Remove agent from list (user won't see this since they're disconnected)
        setAgents((prev) => prev.filter((a) => a.id !== parkEvent.agentId));
      }

      // Agent warming (resuming session after user returned)
      if (msg.data?.type === 'agent_warming') {
        const warmEvent = msg.data as {
          type: string;
          agentId: string;
          activity?: string;
        };

        setAgents((prev) => {
          const existing = prev.find((a) => a.id === warmEvent.agentId);
          if (existing) {
            // Update existing agent to warming state
            return prev.map((a) =>
              a.id === warmEvent.agentId
                ? {
                    ...a,
                    state: 'working',
                    lifecycleState: 'warming',
                    currentActivity: warmEvent.activity || 'Resuming session...',
                  }
                : a
            );
          }
          // Agent doesn't exist yet — add it with warming state
          return [
            ...prev,
            {
              id: warmEvent.agentId,
              role: inferRoleFromId(warmEvent.agentId),
              state: 'working',
              lifecycleState: 'warming',
              currentActivity: warmEvent.activity || 'Resuming session...',
              hasQuestion: false,
            },
          ];
        });
      }

      // Question added
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
          if (prev.some((q) => q.question_id === newQuestion.question_id)) {
            return prev;
          }
          return [...prev, newQuestion];
        });

        setPendingQuestions((prev) => prev + 1);
      }

      // Question answered
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

  // ── Accessors ────────────────────────────────────────────────────────

  const getAgent = (id: string) => agents.find((a) => a.id === id);
  const getAgentsNeedingInput = () => agents.filter((a) => a.state === 'needs_input');
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
