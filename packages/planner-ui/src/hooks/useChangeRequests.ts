import { useState, useEffect, useCallback } from 'react';
import type { ChangeRequest, PlanVersion } from '@/types';
import {
  getChangeRequests,
  acceptChangeRequest as apiAcceptChangeRequest,
  rejectChangeRequest as apiRejectChangeRequest,
  createMockChangeRequests,
} from '@/api';

interface UseChangeRequestsOptions {
  /** Use mock data instead of real API */
  useMock?: boolean;
  /** Poll interval in ms (0 to disable) */
  pollInterval?: number;
}

interface UseChangeRequestsResult {
  /** Pending change requests */
  changeRequests: ChangeRequest[];
  /** Whether loading is in progress */
  isLoading: boolean;
  /** Current action being processed */
  processingId: string | null;
  /** Error message if any */
  error: string | null;
  /** Refresh the list */
  refresh: () => void;
  /** Accept a change request */
  accept: (changeRequestId: string) => Promise<{ version: number } | null>;
  /** Reject a change request */
  reject: (changeRequestId: string, reason?: string) => Promise<boolean>;
}

/**
 * Hook for managing change requests from orchestrator.
 */
export function useChangeRequests(
  version: PlanVersion | null,
  options: UseChangeRequestsOptions = {}
): UseChangeRequestsResult {
  const { useMock = true, pollInterval = 0 } = options;

  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchChangeRequests = useCallback(async () => {
    if (!version) {
      setChangeRequests([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (useMock) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 300));
        const mockData = createMockChangeRequests(version.plan_id, version.steps);
        setChangeRequests(mockData);
      } else {
        const data = await getChangeRequests(version.plan_id);
        setChangeRequests(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch change requests';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [version, useMock]);

  // Initial fetch
  useEffect(() => {
    fetchChangeRequests();
  }, [fetchChangeRequests]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const intervalId = setInterval(fetchChangeRequests, pollInterval);
    return () => clearInterval(intervalId);
  }, [fetchChangeRequests, pollInterval]);

  const accept = useCallback(
    async (changeRequestId: string): Promise<{ version: number } | null> => {
      if (!version) return null;

      setProcessingId(changeRequestId);
      setError(null);

      try {
        if (useMock) {
          // Simulate API delay
          await new Promise((resolve) => setTimeout(resolve, 800));
          // Remove from local state
          setChangeRequests((prev) =>
            prev.map((cr) =>
              cr.change_request_id === changeRequestId
                ? { ...cr, status: 'applied' as const, result_version: version.version + 1 }
                : cr
            )
          );
          return { version: version.version + 1 };
        } else {
          const result = await apiAcceptChangeRequest(version.plan_id, changeRequestId);
          // Refresh list
          await fetchChangeRequests();
          return result;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept change request';
        setError(errorMessage);
        return null;
      } finally {
        setProcessingId(null);
      }
    },
    [version, useMock, fetchChangeRequests]
  );

  const reject = useCallback(
    async (changeRequestId: string, reason?: string): Promise<boolean> => {
      if (!version) return false;

      setProcessingId(changeRequestId);
      setError(null);

      try {
        if (useMock) {
          // Simulate API delay
          await new Promise((resolve) => setTimeout(resolve, 500));
          // Remove from local state
          setChangeRequests((prev) =>
            prev.map((cr) =>
              cr.change_request_id === changeRequestId
                ? { ...cr, status: 'rejected' as const }
                : cr
            )
          );
          return true;
        } else {
          await apiRejectChangeRequest(version.plan_id, changeRequestId, reason);
          // Refresh list
          await fetchChangeRequests();
          return true;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to reject change request';
        setError(errorMessage);
        return false;
      } finally {
        setProcessingId(null);
      }
    },
    [version, useMock, fetchChangeRequests]
  );

  return {
    changeRequests: changeRequests.filter((cr) => cr.status === 'pending'),
    isLoading,
    processingId,
    error,
    refresh: fetchChangeRequests,
    accept,
    reject,
  };
}
