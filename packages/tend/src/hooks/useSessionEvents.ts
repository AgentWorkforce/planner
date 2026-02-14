import { useEffect, useRef, useCallback } from 'react';
import { TranscriptMessage } from './useIdeationApi';

const API_BASE_URL = '/api/ideation';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface SessionEventHandlers {
  onTranscript?: (messages: TranscriptMessage[]) => void;
  onUnderstanding?: (understanding: Record<string, Record<string, unknown>>) => void;
  onStatus?: (status: 'active' | 'abandoned') => void;
  onConfidence?: (score: number, breakdown: Record<string, string>) => void;
}

export function useSessionEvents(
  sessionId: string | undefined,
  handlers: SessionEventHandlers
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/sessions/${sessionId}/events`;
    console.log(`[useSessionEvents] Connecting to SSE: ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useSessionEvents] SSE connection opened for session ${sessionId}`);
      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      console.log(`[useSessionEvents] Received SSE message:`, event.data);
      try {
        const data = JSON.parse(event.data);
        console.log(`[useSessionEvents] Parsed event type: ${data.type}`);

        switch (data.type) {
          case 'ping':
            console.log(`[useSessionEvents] Received ping`);
            break;
          case 'transcript_updated':
            console.log(`[useSessionEvents] Calling onTranscript with ${data.transcript?.length || 0} messages`);
            handlersRef.current.onTranscript?.(data.transcript);
            break;
          case 'understanding_updated':
            handlersRef.current.onUnderstanding?.(data.understanding);
            break;
          case 'status_changed':
            handlersRef.current.onStatus?.(data.status);
            break;
          case 'confidence_changed':
            handlersRef.current.onConfidence?.(data.score, data.breakdown);
            break;
          default:
            console.log(`[useSessionEvents] Unknown event type: ${data.type}`);
        }
      } catch (err) {
        console.error(`[useSessionEvents] Parse error:`, err);
      }
    };

    eventSource.onerror = (err) => {
      console.error(`[useSessionEvents] SSE error for session ${sessionId}:`, err);
      eventSource.close();

      // Limit reconnect attempts to prevent infinite loop
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 3);
        console.log(`[useSessionEvents] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.error(`[useSessionEvents] Max reconnect attempts reached`);
      }
    };

    eventSourceRef.current = eventSource;
  }, [sessionId]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);
}
