/**
 * usePendingGates - Hook for fetching and subscribing to pending gates
 *
 * Provides pending gates data with SSE subscription for real-time updates
 * on gate_reached, gate_approved, and gate_rejected events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPendingGates } from '@/api';
import { FORGE_API_BASE } from '@/api/client';
import type { Gate, ForgeEventUnion } from '@/types';

interface UsePendingGatesOptions {
  runId?: string;
  enabled?: boolean;
  onGateReached?: (gate: Gate) => void;
}

interface UsePendingGatesResult {
  gates: Gate[];
  count: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePendingGates(
  options: UsePendingGatesOptions = {}
): UsePendingGatesResult {
  const { runId, enabled = true, onGateReached } = options;

  const [gates, setGates] = useState<Gate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable reference for callback
  const onGateReachedRef = useRef(onGateReached);
  onGateReachedRef.current = onGateReached;

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch pending gates
  const fetchGates = useCallback(async () => {
    if (!enabled) {
      setGates([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getPendingGates(runId);
      setGates(response.gates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending gates'));
    } finally {
      setIsLoading(false);
    }
  }, [runId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchGates();
  }, [fetchGates]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Determine SSE endpoint - either run-specific or global pending gates
    const sseUrl = runId
      ? `${FORGE_API_BASE}/runs/${runId}/events`
      : `${FORGE_API_BASE}/gates/events`;

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ForgeEventUnion | GateEvent;

          // Handle gate-related events
          if (isGateEvent(data)) {
            handleGateEvent(data);
          }
        } catch (err) {
          console.error('[usePendingGates] Failed to parse event:', err);
        }
      };

      eventSource.onerror = () => {
        console.warn('[usePendingGates] SSE connection error, will retry');
      };

      return () => {
        eventSource.close();
        eventSourceRef.current = null;
      };
    } catch (err) {
      console.error('[usePendingGates] Failed to create EventSource:', err);
    }

    function handleGateEvent(event: GateEvent) {
      switch (event.type) {
        case 'gate_reached':
          // Add new gate to list
          if (event.data.gate) {
            setGates((prev) => {
              // Avoid duplicates
              if (prev.some((g) => g.gate_id === event.data.gate!.gate_id)) {
                return prev;
              }
              // Notify callback
              onGateReachedRef.current?.(event.data.gate!);
              return [...prev, event.data.gate!];
            });
          } else {
            // If no gate data in event, refetch
            fetchGates();
          }
          break;

        case 'gate_approved':
        case 'gate_rejected':
          // Remove gate from pending list
          setGates((prev) =>
            prev.filter((g) => g.gate_id !== event.data.gate_id)
          );
          break;

        default:
          // Unknown gate event type, refetch to be safe
          fetchGates();
      }
    }
  }, [runId, enabled, fetchGates]);

  return {
    gates,
    count: gates.length,
    isLoading,
    error,
    refetch: fetchGates,
  };
}

// Gate-specific event types
interface GateEvent {
  type: 'gate_reached' | 'gate_approved' | 'gate_rejected';
  run_id: string;
  timestamp: string;
  data: {
    gate_id: string;
    gate?: Gate;
    status?: string;
  };
}

function isGateEvent(event: unknown): event is GateEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    e.type === 'gate_reached' ||
    e.type === 'gate_approved' ||
    e.type === 'gate_rejected'
  );
}
