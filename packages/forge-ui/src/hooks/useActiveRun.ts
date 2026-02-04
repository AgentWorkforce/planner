/**
 * useActiveRun - Hook for determining and subscribing to the active run
 *
 * Priority order:
 * 1. If URL is /forge/runs/:id, that run is active
 * 2. Any run with status='running'
 * 3. Most recent run by started_at
 *
 * Includes SSE subscription for run status changes.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { listRuns, getRun } from '@/api/runs';
import { FORGE_API_BASE } from '@/api/client';
import type { Run, RunStatus, ForgeEventUnion } from '@/types';

interface UseActiveRunResult {
  /** The currently active run (full details) */
  activeRun: Run | null;
  /** Whether the active run is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Count of other runs currently running (excluding active run) */
  otherRunningCount: number;
  /** Refetch the active run */
  refetch: () => Promise<void>;
}

export function useActiveRun(): UseActiveRunResult {
  const { runId: urlRunId } = useParams<{ runId?: string }>();
  const location = useLocation();

  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [otherRunningCount, setOtherRunningCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check if we're on a run detail page
  const isOnRunPage = useMemo(() => {
    return location.pathname.includes('/forge/runs/') && urlRunId;
  }, [location.pathname, urlRunId]);

  // Fetch the active run based on priority
  const fetchActiveRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Priority 1: URL specifies a run ID
      if (isOnRunPage && urlRunId) {
        const run = await getRun(urlRunId);
        if (mountedRef.current) {
          setActiveRun(run);

          // Count other running runs
          const response = await listRuns({ status: 'running' as RunStatus, limit: 100 });
          const otherRunning = response.runs.filter((r) => r.run_id !== urlRunId);
          setOtherRunningCount(otherRunning.length);
        }
        return;
      }

      // Fetch all runs to determine active one
      const response = await listRuns({ limit: 100 });

      if (!mountedRef.current) return;

      // Priority 2: Any run with status='running'
      const runningRuns = response.runs.filter((r) => r.status === 'running');
      if (runningRuns.length > 0) {
        // Get full details of the first running run
        const run = await getRun(runningRuns[0].run_id);
        if (mountedRef.current) {
          setActiveRun(run);
          setOtherRunningCount(runningRuns.length - 1);
        }
        return;
      }

      // Priority 3: Most recent run by started_at
      const sortedRuns = [...response.runs].sort((a, b) => {
        const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bTime - aTime;
      });

      if (sortedRuns.length > 0) {
        const run = await getRun(sortedRuns[0].run_id);
        if (mountedRef.current) {
          setActiveRun(run);
          setOtherRunningCount(0);
        }
      } else {
        if (mountedRef.current) {
          setActiveRun(null);
          setOtherRunningCount(0);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch active run'));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isOnRunPage, urlRunId]);

  // Handle SSE events for run updates
  const handleEvent = useCallback(
    (event: ForgeEventUnion) => {
      if (!mountedRef.current || !activeRun) return;

      if (event.type === 'run_status_changed' && event.run_id === activeRun.run_id) {
        setActiveRun((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: event.data.status as Run['status'],
            completed_tasks: event.data.tasks_completed ?? prev.completed_tasks,
            updated_at: event.timestamp,
          };
        });
      }
    },
    [activeRun]
  );

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchActiveRun();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchActiveRun]);

  // SSE subscription for active run
  useEffect(() => {
    if (!activeRun) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `${FORGE_API_BASE}/runs/${activeRun.run_id}/events`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ForgeEventUnion;
          handleEvent(data);
        } catch (err) {
          console.error('[useActiveRun] Failed to parse event:', err);
        }
      };

      eventSource.onerror = () => {
        console.warn('[useActiveRun] SSE connection error, will retry');
      };

      return () => {
        eventSource.close();
        eventSourceRef.current = null;
      };
    } catch (err) {
      console.error('[useActiveRun] Failed to create EventSource:', err);
    }
  }, [activeRun?.run_id, handleEvent]);

  // Global SSE subscription for new runs (to update otherRunningCount)
  useEffect(() => {
    const url = `${FORGE_API_BASE}/runs/events`;

    try {
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ForgeEventUnion;
          // Refetch when any run status changes
          if (data.type === 'run_status_changed') {
            fetchActiveRun();
          }
        } catch {
          // Ignore parse errors for global events
        }
      };

      return () => {
        eventSource.close();
      };
    } catch {
      // Silently fail for global SSE
    }
  }, [fetchActiveRun]);

  const refetch = useCallback(async () => {
    await fetchActiveRun();
  }, [fetchActiveRun]);

  return {
    activeRun,
    isLoading,
    error,
    otherRunningCount,
    refetch,
  };
}
