import { useState, useEffect, useCallback } from 'react';
import type { ExecutionStatus } from '@/types';
import { getExecutionStatus } from '@/api';

interface UseExecutionStatusOptions {
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
}

interface UseExecutionStatusResult {
  /** Current execution status, or null if not available */
  execution: ExecutionStatus | null;
  /** Whether the initial fetch is loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh the status */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and poll execution status for a published plan.
 *
 * @param planId - The plan ID
 * @param version - The version number
 * @param options - Polling options
 */
export function useExecutionStatus(
  planId: string | undefined,
  version: number | undefined,
  options: UseExecutionStatusOptions = {}
): UseExecutionStatusResult {
  const { pollInterval = 5000, enabled = true } = options;

  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!planId || version === undefined) {
      setLoading(false);
      return;
    }

    try {
      const status = await getExecutionStatus(planId, version);
      setExecution(status);
      setError(null);
    } catch (err) {
      // Don't set error state for failed fetches - just log
      // This ensures the UI continues to work even if orchestrator is down
      console.warn('Failed to fetch execution status:', err);
    } finally {
      setLoading(false);
    }
  }, [planId, version]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  // Polling
  useEffect(() => {
    if (!enabled || !planId || version === undefined) {
      return;
    }

    const intervalId = setInterval(fetchStatus, pollInterval);

    // Cleanup on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollInterval, fetchStatus, planId, version]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  return {
    execution,
    loading,
    error,
    refresh,
  };
}
