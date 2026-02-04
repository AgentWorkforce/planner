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
 * Uses the dedicated /runs/counts endpoint for efficient counting.
 * Used for the filter tabs count badges.
 */
import { getRunsCounts } from '@/api/runs';

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
  refetch: () => Promise<void>;
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
  const mountedRef = useRef(true);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await getRunsCounts();

      if (mountedRef.current) {
        setCounts({
          all: response.counts.all,
          running: response.counts.running,
          completed: response.counts.completed,
          failed: response.counts.failed,
          paused: response.counts.paused,
          pending: response.counts.pending,
        });
      }
    } catch {
      // Silently fail for counts - not critical
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchCounts();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchCounts]);

  const refetch = useCallback(async () => {
    await fetchCounts();
  }, [fetchCounts]);

  return { counts, isLoading, refetch };
}
