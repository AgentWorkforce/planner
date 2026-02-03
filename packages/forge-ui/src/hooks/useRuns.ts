/**
 * useRuns - Hook for fetching and managing runs list
 *
 * Provides runs data with filtering, loading state, and refetch capability.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listRuns } from '@/api/runs';
import type { RunSummary, RunFilter, RunStatus } from '@/types';

interface UseRunsOptions {
  status?: RunStatus;
  limit?: number;
  offset?: number;
}

interface UseRunsResult {
  runs: RunSummary[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRuns(options: UseRunsOptions = {}): UseRunsResult {
  const { status, limit = 12, offset = 0 } = options;

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filter: RunFilter = { limit, offset };
      if (status) {
        filter.status = status;
      }

      const response = await listRuns(filter);

      if (mountedRef.current) {
        setRuns(response.runs);
        setTotal(response.total);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch runs'));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [status, limit, offset]);

  // Fetch runs on mount and when dependencies change
  useEffect(() => {
    mountedRef.current = true;
    fetchRuns();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchRuns]);

  const refetch = useCallback(async () => {
    await fetchRuns();
  }, [fetchRuns]);

  return {
    runs,
    total,
    isLoading,
    error,
    refetch,
  };
}

/**
 * useRunsCounts - Hook for fetching run counts by status
 *
 * Fetches all runs (without pagination) to calculate status counts.
 * Used for the filter tabs count badges.
 */
interface UseRunsCountsResult {
  counts: {
    all: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
    pending: number;
  };
  isLoading: boolean;
}

export function useRunsCounts(): UseRunsCountsResult {
  const [counts, setCounts] = useState({
    all: 0,
    running: 0,
    completed: 0,
    failed: 0,
    paused: 0,
    pending: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchCounts() {
      try {
        // Fetch a larger batch to get accurate counts
        // In production, you'd want a dedicated API endpoint for counts
        const response = await listRuns({ limit: 1000 });

        if (mounted) {
          const newCounts = {
            all: response.total,
            running: 0,
            completed: 0,
            failed: 0,
            paused: 0,
            pending: 0,
          };

          for (const run of response.runs) {
            switch (run.status) {
              case 'running':
                newCounts.running++;
                break;
              case 'completed':
                newCounts.completed++;
                break;
              case 'failed':
                newCounts.failed++;
                break;
              case 'paused':
                newCounts.paused++;
                break;
              case 'pending':
                newCounts.pending++;
                break;
            }
          }

          setCounts(newCounts);
        }
      } catch {
        // Silently fail for counts - not critical
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCounts();

    return () => {
      mounted = false;
    };
  }, []);

  return { counts, isLoading };
}
