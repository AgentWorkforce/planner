/**
 * usePlanEvents Hook
 *
 * Manages EventSource connection for real-time plan change notifications.
 * Subscribes to SSE endpoint when AI agent is connected, receives events
 * when agent modifies the plan, and calls callback to trigger refresh.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/** Plan change event data from SSE */
export interface PlanChangeEvent {
  version: number;
  changeType: 'step_added' | 'step_edited' | 'step_removed' | 'criteria_added' | 'criteria_edited';
  stepId?: string;
  timestamp: string;
}

/** Hook return type */
export interface UsePlanEventsReturn {
  isConnected: boolean;
  error: string | null;
}

/** Maximum reconnection attempts */
const MAX_RETRIES = 5;

/** Delay between reconnection attempts (ms) */
const RECONNECT_DELAY_MS = 3000;

/**
 * Subscribe to plan change events via SSE.
 *
 * @param planId - Plan ID to subscribe to
 * @param enabled - Whether to connect (typically connectionStatus === 'connected')
 * @param onEvent - Callback when plan change event is received
 * @returns Connection status and error state
 */
export function usePlanEvents(
  planId: string | null,
  enabled: boolean,
  onEvent: (event: PlanChangeEvent) => void
): UsePlanEventsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and reconnection
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable reference to onEvent callback
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!planId) return;

    cleanup();
    setError(null);

    const url = `/api/plans/${planId}/events`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      retryCountRef.current = 0; // Reset retry count on successful connection
    };

    eventSource.addEventListener('plan_change', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PlanChangeEvent;
        onEventRef.current(data);
      } catch (err) {
        console.error('[usePlanEvents] Failed to parse event:', err);
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnection if under max retries
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setError(`Connection lost. Reconnecting (${retryCountRef.current}/${MAX_RETRIES})...`);
        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      } else {
        setError('Connection failed after multiple attempts. Please refresh the page.');
      }
    };
  }, [planId, cleanup]);

  // Effect to manage connection lifecycle
  useEffect(() => {
    if (enabled && planId) {
      connect();
    } else {
      cleanup();
      retryCountRef.current = 0;
      setError(null);
    }

    return cleanup;
  }, [enabled, planId, connect, cleanup]);

  return { isConnected, error };
}
