/**
 * useRunningUpdates - Hook for real-time updates on running runs
 *
 * Subscribes to SSE for each running run and provides live progress updates.
 * Returns a map of runId -> update data for efficient lookups.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FORGE_API_BASE } from '@/api/client';
import type { RunStatus } from '@/types';

interface RunUpdate {
  completed_tasks: number;
  failed_tasks: number;
  status: RunStatus;
}

interface UseRunningUpdatesResult {
  updates: Map<string, RunUpdate>;
  getUpdate: (runId: string) => RunUpdate | undefined;
}

export function useRunningUpdates(runIds: string[]): UseRunningUpdatesResult {
  const [updates, setUpdates] = useState<Map<string, RunUpdate>>(new Map());
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Stable reference for current runIds
  const runIdsRef = useRef(runIds);
  runIdsRef.current = runIds;

  // Subscribe to SSE for a single run
  const subscribeToRun = useCallback((runId: string) => {
    // Don't create duplicate connections
    if (eventSourcesRef.current.has(runId)) {
      return;
    }

    const url = `${FORGE_API_BASE}/runs/${runId}/events`;

    try {
      const eventSource = new EventSource(url);
      eventSourcesRef.current.set(runId, eventSource);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle run_updated events
          if (data.type === 'run_updated' && data.data) {
            const update: RunUpdate = {
              completed_tasks: data.data.completed_tasks ?? 0,
              failed_tasks: data.data.failed_tasks ?? 0,
              status: data.data.status,
            };

            setUpdates((prev) => {
              const next = new Map(prev);
              next.set(runId, update);
              return next;
            });

            // If run completed/failed/cancelled, close the connection
            if (
              data.data.status === 'completed' ||
              data.data.status === 'failed' ||
              data.data.status === 'cancelled'
            ) {
              unsubscribeFromRun(runId);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // Clean up on error
        unsubscribeFromRun(runId);
      };
    } catch {
      // Silently fail - not critical for list view
    }
  }, []);

  // Unsubscribe from SSE for a single run
  const unsubscribeFromRun = useCallback((runId: string) => {
    const eventSource = eventSourcesRef.current.get(runId);
    if (eventSource) {
      eventSource.close();
      eventSourcesRef.current.delete(runId);
    }
  }, []);

  // Manage subscriptions when runIds change
  useEffect(() => {
    const currentRunIds = new Set(runIds);
    const subscribedRunIds = new Set(eventSourcesRef.current.keys());

    // Subscribe to new runs
    for (const runId of runIds) {
      if (!subscribedRunIds.has(runId)) {
        subscribeToRun(runId);
      }
    }

    // Unsubscribe from runs no longer in the list
    for (const runId of subscribedRunIds) {
      if (!currentRunIds.has(runId)) {
        unsubscribeFromRun(runId);
      }
    }

    // Cleanup on unmount
    return () => {
      for (const runId of eventSourcesRef.current.keys()) {
        unsubscribeFromRun(runId);
      }
    };
  }, [runIds, subscribeToRun, unsubscribeFromRun]);

  // Helper to get update for a specific run
  const getUpdate = useCallback(
    (runId: string): RunUpdate | undefined => {
      return updates.get(runId);
    },
    [updates]
  );

  return {
    updates,
    getUpdate,
  };
}
