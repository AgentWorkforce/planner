/**
 * useRun - Hook for fetching and subscribing to a single run
 *
 * Features:
 * - Initial fetch via getRun API
 * - SSE subscription for live updates using useRunEvents
 * - Updates local state on task_status_changed, run_status_changed events
 * - Elapsed time counter updates every second for running runs
 * - activeGate computed from gates with status 'waiting'
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getRun } from '@/api/runs';
import { useRunEvents } from '@/hooks/useRunEvents';
import {
  RunStatus,
  GateStatus,
  type Run,
  type Task,
  type Gate,
  type Agent,
  type ForgeEventUnion,
  type TaskStatus,
} from '@/types';

interface UseRunResult {
  run: Run | null;
  tasks: Task[];
  activeGate: Gate | null;
  agents: Agent[];
  elapsedMs: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRun(runId: string | null | undefined): UseRunResult {
  const [run, setRun] = useState<Run | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute active gate (first gate with waiting status)
  const activeGate = useMemo(() => {
    return gates.find((g) => g.status === GateStatus.WAITING) || null;
  }, [gates]);

  // Fetch run data
  const fetchRun = useCallback(async () => {
    if (!runId) {
      setRun(null);
      setTasks([]);
      setGates([]);
      setAgents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getRun(runId);

      if (mountedRef.current) {
        setRun(response);

        // Note: In a real implementation, tasks/gates/agents would come from
        // additional API calls or be embedded in the run response.
        // For now, we'll initialize empty and let SSE populate them.
        // If the API returns these, update here.
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch run'));
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
      case 'run_updated':
        setRun((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: event.data.status as RunStatus,
            completed_tasks: event.data.completed_tasks,
            failed_tasks: event.data.failed_tasks,
          };
        });
        break;

      case 'task_updated':
        setTasks((prev) => {
          const taskId = event.data.task_id;
          const existingIndex = prev.findIndex((t) => t.task_id === taskId);

          if (existingIndex >= 0) {
            // Update existing task
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              status: event.data.status as TaskStatus,
              assigned_agent_id: event.data.assigned_agent_id,
            };
            return updated;
          }

          // New task - would need full task data from API
          // For now, we'll skip adding new tasks via SSE
          return prev;
        });
        break;

      case 'gate_updated':
        setGates((prev) => {
          const gateId = event.data.gate_id;
          const existingIndex = prev.findIndex((g) => g.gate_id === gateId);

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              status: event.data.status as GateStatus,
            };
            return updated;
          }

          return prev;
        });
        break;

      case 'agent_updated':
        setAgents((prev) => {
          const agentId = event.data.agent_id;
          const existingIndex = prev.findIndex((a) => a.agent_id === agentId);

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              state: event.data.state as Agent['state'],
              current_task_id: event.data.current_task_id,
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

  // Calculate elapsed time
  useEffect(() => {
    // Clear any existing timer
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }

    if (!run?.started_at) {
      setElapsedMs(0);
      return;
    }

    const startTime = new Date(run.started_at).getTime();

    // If run is completed/failed/cancelled, calculate final elapsed time
    if (run.completed_at) {
      const endTime = new Date(run.completed_at).getTime();
      setElapsedMs(endTime - startTime);
      return;
    }

    // If run is still active, update every second
    if (run.status === RunStatus.RUNNING || run.status === RunStatus.PAUSED) {
      // Set initial value
      setElapsedMs(Date.now() - startTime);

      // Update every second
      elapsedTimerRef.current = setInterval(() => {
        if (mountedRef.current) {
          setElapsedMs(Date.now() - startTime);
        }
      }, 1000);
    }

    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };
  }, [run?.started_at, run?.completed_at, run?.status]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchRun();

    return () => {
      mountedRef.current = false;
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };
  }, [fetchRun]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchRun();
  }, [fetchRun]);

  return {
    run,
    tasks,
    activeGate,
    agents,
    elapsedMs,
    isLoading,
    error: error || sseError,
    refetch,
  };
}

/**
 * Hook to fetch tasks for a run
 */
export function useRunTasks(runId: string | null | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!runId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function fetchTasks() {
      setIsLoading(true);
      try {
        // In a real implementation, this would call the tasks API
        // const response = await getRunTasks(runId);
        // setTasks(response.tasks);

        // For now, return empty array
        if (mounted) {
          setTasks([]);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTasks();

    return () => {
      mounted = false;
    };
  }, [runId]);

  return { tasks, isLoading, error };
}
