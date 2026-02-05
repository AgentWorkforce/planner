/**
 * useRunEvents - SSE hook for real-time run updates
 *
 * Subscribes to server-sent events for a specific run and
 * provides connection status and error handling.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { FORGE_API_BASE } from '@/api/client';
import type { ForgeEventUnion } from '@/types';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

interface UseRunEventsOptions {
  onEvent?: (event: ForgeEventUnion) => void;
  enabled?: boolean;
}

interface UseRunEventsResult {
  isConnected: boolean;
  error: Error | null;
}

export function useRunEvents(
  runId: string | null | undefined,
  options: UseRunEventsOptions = {}
): UseRunEventsResult {
  const { onEvent, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable reference for onEvent callback
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!runId || !enabled) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `${FORGE_API_BASE}/runs/${runId}/events`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ForgeEventUnion;
          onEventRef.current?.(data);
        } catch (err) {
          console.error('[useRunEvents] Failed to parse event:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);

        // EventSource will auto-reconnect, but we track retries
        retryCountRef.current += 1;

        if (retryCountRef.current >= MAX_RETRIES) {
          eventSource.close();
          eventSourceRef.current = null;
          setError(new Error('Max reconnection attempts reached'));
          return;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1),
          MAX_RETRY_DELAY
        );

        // Clear any existing retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        // Schedule reconnection
        retryTimeoutRef.current = setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            connect();
          }
        }, delay);
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      setIsConnected(false);
    }
  }, [runId, enabled]);

  // Connect when runId changes or enabled changes
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount or when dependencies change
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connect]);

  return { isConnected, error };
}
