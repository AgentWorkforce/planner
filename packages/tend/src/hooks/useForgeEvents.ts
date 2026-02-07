/**
 * SSE hook for Forge execution events
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ForgeEvent {
  type: string;
  timestamp: string;
  data: any;
}

export interface UseForgeEventsOptions {
  runId: string;
  enabled?: boolean;
  onEvent?: (event: ForgeEvent) => void;
  onError?: (error: Error) => void;
}

export function useForgeEvents({
  runId,
  enabled = true,
  onEvent,
  onError,
}: UseForgeEventsOptions) {
  const [events, setEvents] = useState<ForgeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !runId) {
      return;
    }

    cleanup();

    try {
      const url = `/api/forge/runs/${runId}/events`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const forgeEvent: ForgeEvent = JSON.parse(event.data);

          setEvents((prev) => [...prev, forgeEvent]);

          if (onEvent) {
            onEvent(forgeEvent);
          }
        } catch (err) {
          console.error('Failed to parse forge event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('Forge SSE error:', err);
        setIsConnected(false);

        const errorObj = new Error('Forge SSE connection failed');
        setError(errorObj);

        if (onError) {
          onError(errorObj);
        }

        cleanup();

        // Exponential backoff reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to create Forge EventSource:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }, [enabled, runId, onEvent, onError, cleanup]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    events,
    isConnected,
    error,
    reconnect,
  };
}
