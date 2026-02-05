/**
 * useArtifacts - Hook for managing artifacts with SSE-based updates
 *
 * Features:
 * - Fetch artifacts for a run
 * - Listen for artifact_updated events via SSE
 * - Update artifact metadata in local state
 * - Track last_updated for staleness
 * - Support for refreshing PR status
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getRunArtifacts, refreshPRStatus } from '@/api';
import { useRunEvents } from './useRunEvents';
import type { Artifact, ArtifactUpdatedEvent, ForgeEventUnion } from '@/types';

interface UseArtifactsOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseArtifactsResult {
  artifacts: Artifact[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refreshPR: (artifactId: string) => Promise<void>;
  refreshingArtifacts: Set<string>;
  getTaskArtifacts: (taskId: string) => Artifact[];
}

export function useArtifacts(
  runId: string | null | undefined,
  options: UseArtifactsOptions = {}
): UseArtifactsResult {
  const { enabled = true, onError } = options;

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshingArtifacts, setRefreshingArtifacts] = useState<Set<string>>(new Set());

  // Stable reference for onError
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Fetch artifacts
  const fetchArtifacts = useCallback(async () => {
    if (!runId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getRunArtifacts(runId);
      setArtifacts(response.artifacts);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch artifacts');
      setError(error);
      onErrorRef.current?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [runId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Handle SSE events
  const handleEvent = useCallback((event: ForgeEventUnion) => {
    if (event.type === 'artifact_updated') {
      const artifactEvent = event as ArtifactUpdatedEvent;
      setArtifacts((prev) =>
        prev.map((artifact) =>
          artifact.artifact_id === artifactEvent.data.artifact_id
            ? {
                ...artifact,
                metadata: {
                  ...artifact.metadata,
                  ...artifactEvent.data.metadata,
                  last_updated: event.timestamp,
                },
              }
            : artifact
        )
      );
    }
  }, []);

  // Subscribe to SSE events
  useRunEvents(runId, {
    onEvent: handleEvent,
    enabled: enabled && !!runId,
  });

  // Refresh a specific PR's status
  const refreshPR = useCallback(async (artifactId: string) => {
    setRefreshingArtifacts((prev) => new Set(prev).add(artifactId));

    try {
      const updatedArtifact = await refreshPRStatus(artifactId);
      setArtifacts((prev) =>
        prev.map((artifact) =>
          artifact.artifact_id === artifactId ? updatedArtifact : artifact
        )
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh PR status');
      onErrorRef.current?.(error);
    } finally {
      setRefreshingArtifacts((prev) => {
        const next = new Set(prev);
        next.delete(artifactId);
        return next;
      });
    }
  }, []);

  // Get artifacts for a specific task
  const getTaskArtifacts = useCallback(
    (taskId: string): Artifact[] => {
      return artifacts.filter((artifact) => artifact.task_id === taskId);
    },
    [artifacts]
  );

  return {
    artifacts,
    isLoading,
    error,
    refetch: fetchArtifacts,
    refreshPR,
    refreshingArtifacts,
    getTaskArtifacts,
  };
}

/**
 * Hook for getting artifacts grouped by type
 */
export function useArtifactsGrouped(
  runId: string | null | undefined,
  options?: UseArtifactsOptions
) {
  const result = useArtifacts(runId, options);

  const groupedByType = useMemo(() => {
    const groups = new Map<string, Artifact[]>();
    for (const artifact of result.artifacts) {
      const existing = groups.get(artifact.type) || [];
      existing.push(artifact);
      groups.set(artifact.type, existing);
    }
    return groups;
  }, [result.artifacts]);

  const groupedByTask = useMemo(() => {
    const groups = new Map<string, Artifact[]>();
    for (const artifact of result.artifacts) {
      const existing = groups.get(artifact.task_id) || [];
      existing.push(artifact);
      groups.set(artifact.task_id, existing);
    }
    return groups;
  }, [result.artifacts]);

  return {
    ...result,
    groupedByType,
    groupedByTask,
  };
}
