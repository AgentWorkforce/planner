/**
 * useGlobalEvents — cross-session notification listener.
 *
 * Connects to GET /api/events/global?exclude_session={sessionId} via
 * EventSource. On each event, pushes an alert to the status bar with
 * a "View" action that navigates to the originating session.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UseStatusLineReturn } from './useStatusLine';

interface GlobalEvent {
  type: 'build:completed' | 'build:failed' | 'gate:pending' | 'question:pending';
  sourceSessionId: string;
  planId: string;
  runId: string;
  stepName?: string;
  summary: string;
  timestamp: string;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

/**
 * Subscribe to global cross-session events via SSE.
 * Pushes alerts into the status bar for events from OTHER sessions.
 *
 * @param sessionId - Current session ID (used for exclude_session filter)
 * @param statusLine - The useStatusLine return value for pushing alerts
 */
export function useGlobalEvents(
  sessionId: string | null,
  statusLine: UseStatusLineReturn,
): void {
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  // Stable refs for callbacks that change each render
  const pushAlertRef = useRef(statusLine.pushAlert);
  pushAlertRef.current = statusLine.pushAlert;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const connect = useCallback((sid: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `/api/events/global?exclude_session=${encodeURIComponent(sid)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as GlobalEvent;

        pushAlertRef.current(data.summary, {
          label: 'View',
          onClick: () => {
            navigateRef.current(`/s/${data.sourceSessionId}?tab=forge`);
          },
        });
      } catch (err) {
        console.error('[useGlobalEvents] Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttemptsRef.current, 3);
        console.log(
          `[useGlobalEvents] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect(sid);
        }, delay);
      } else {
        console.error('[useGlobalEvents] Max reconnect attempts reached');
      }
    };

    eventSourceRef.current = eventSource;
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    reconnectAttemptsRef.current = 0;
    connect(sessionId);

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [sessionId, connect]);
}
