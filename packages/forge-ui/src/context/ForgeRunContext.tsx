/**
 * ForgeRunContext - Context for active run state management
 *
 * Provides run data, tasks, gates, questions, and agents to child components.
 * Manages SSE subscription for real-time updates.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRunEvents } from '@/hooks/useRunEvents';
import { getRun } from '@/api/runs';
import {
  QuestionStatus,
  type Run,
  type Task,
  type Gate,
  type Question,
  type Agent,
  type ForgeEventUnion,
  type TaskStatus,
  type GateStatus,
  type AgentState,
} from '@/types';

interface ForgeRunContextValue {
  // Active run data
  activeRun: Run | null;
  tasks: Task[];
  gates: Gate[];
  questions: Question[];
  agents: Agent[];

  // Loading and error states
  isLoading: boolean;
  error: Error | null;

  // SSE connection status
  isConnected: boolean;

  // Actions
  refreshRun: () => Promise<void>;
  setActiveRunId: (runId: string | null) => void;
}

const ForgeRunContext = createContext<ForgeRunContextValue | null>(null);

interface ForgeRunProviderProps {
  children: ReactNode;
  initialRunId?: string | null;
}

export function ForgeRunProvider({
  children,
  initialRunId = null,
}: ForgeRunProviderProps) {
  const [activeRunId, setActiveRunId] = useState<string | null>(initialRunId);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch run data
  const refreshRun = useCallback(async () => {
    if (!activeRunId) {
      setActiveRun(null);
      setTasks([]);
      setGates([]);
      setQuestions([]);
      setAgents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const run = await getRun(activeRunId);
      setActiveRun(run);
      // In a real implementation, you would also fetch tasks, gates, questions, agents
      // For now, we just set the run
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch run'));
    } finally {
      setIsLoading(false);
    }
  }, [activeRunId]);

  // Handle SSE events
  const handleEvent = useCallback((event: ForgeEventUnion) => {
    switch (event.type) {
      case 'run_status_changed':
        setActiveRun((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: event.data.status as Run['status'],
            completed_tasks: event.data.tasks_completed ?? prev.completed_tasks,
            updated_at: event.timestamp,
          };
        });
        break;

      case 'task_status_changed':
        setTasks((prev) =>
          prev.map((task) =>
            task.task_id === event.data.task_id
              ? {
                  ...task,
                  status: event.data.status as TaskStatus,
                  assigned_agent_id: event.data.agent_id,
                  updated_at: event.timestamp,
                }
              : task
          )
        );
        break;

      case 'gate_reached':
        // Gate reached - add or update the gate
        setGates((prev) => {
          const existingIdx = prev.findIndex((g) => g.gate_id === event.data.gate_id);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              status: 'waiting' as GateStatus,
              updated_at: event.timestamp,
            };
            return updated;
          }
          // Add new gate
          const newGate: Gate = {
            gate_id: event.data.gate_id,
            task_id: event.data.task_id || '',
            run_id: event.run_id,
            step_id: event.data.step_id || '',
            status: 'waiting' as GateStatus,
            gate_type: 'human_approval',
            title: event.data.step_title || 'Approval Gate',
            approver_role: event.data.approver_role,
            blocked_tasks: [],
            created_at: event.timestamp,
            updated_at: event.timestamp,
          };
          return [...prev, newGate];
        });
        break;

      case 'question_asked':
        // Add new question to the list
        setQuestions((prev) => {
          // Check if question already exists
          if (prev.some((q) => q.question_id === event.data.question_id)) {
            return prev;
          }
          return [
            ...prev,
            {
              question_id: event.data.question_id,
              run_id: event.run_id,
              task_id: '', // Will be populated by full fetch
              agent_id: event.data.agent_id,
              text: event.data.question_text,
              blocking_level: event.data.blocking_level as Question['blocking_level'],
              status: QuestionStatus.PENDING,
              steps_blocked: 0,
              cascade_depth: 0,
              can_use_default: false,
              subscribers: [],
              priority_score: 0,
              created_at: event.timestamp,
            },
          ];
        });
        break;

      case 'agent_updated':
        setAgents((prev) =>
          prev.map((agent) =>
            agent.agent_id === event.data.agent_id
              ? {
                  ...agent,
                  state: event.data.state as AgentState,
                  current_task_id: event.data.current_task_id,
                  last_activity_at: event.timestamp,
                }
              : agent
          )
        );
        break;
    }
  }, []);

  // SSE subscription
  const { isConnected } = useRunEvents(activeRunId, {
    onEvent: handleEvent,
    enabled: !!activeRunId,
  });

  const value = useMemo<ForgeRunContextValue>(
    () => ({
      activeRun,
      tasks,
      gates,
      questions,
      agents,
      isLoading,
      error,
      isConnected,
      refreshRun,
      setActiveRunId,
    }),
    [
      activeRun,
      tasks,
      gates,
      questions,
      agents,
      isLoading,
      error,
      isConnected,
      refreshRun,
    ]
  );

  return (
    <ForgeRunContext.Provider value={value}>
      {children}
    </ForgeRunContext.Provider>
  );
}

/**
 * Hook to access the ForgeRunContext
 */
export function useForgeRun(): ForgeRunContextValue {
  const context = useContext(ForgeRunContext);
  if (!context) {
    throw new Error('useForgeRun must be used within a ForgeRunProvider');
  }
  return context;
}
