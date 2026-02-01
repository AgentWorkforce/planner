import { useEffect, useRef, useCallback } from 'react';
import { TranscriptMessage } from './useIdeationApi';

const API_BASE_URL = '/api/ideation';
const RECONNECT_DELAY = 3000;

interface SessionEventHandlers {
  onTranscript?: (messages: TranscriptMessage[]) => void;
  onUnderstanding?: (understanding: Record<string, Record<string, unknown>>) => void;
  onStatus?: (status: 'active' | 'abandoned') => void;
  onConfidence?: (score: number, breakdown: Record<string, number>) => void;
}

export function useSessionEvents(
  sessionId: string | undefined,
  handlers: SessionEventHandlers
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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

    const eventSource = new EventSource(
      `${API_BASE_URL}/sessions/${sessionId}/events`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'transcript_updated':
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
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Auto-reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY);
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
