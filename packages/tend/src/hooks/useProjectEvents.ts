/**
 * useProjectEvents - Composition hook for unified project event stream
 *
 * Composes 3 existing SSE streams into one unified feed:
 * - Ideation session events (blocks, understanding, confidence)
 * - Planner events (plan changes, step updates)
 * - Forge run events (task progress, agent activity, trajectory)
 *
 * Does NOT create new endpoints — reuses existing SSE infrastructure.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProjectEvent {
  type: 'ideation' | 'planner' | 'forge';
  event: string;       // e.g. 'block:created', 'plan:updated', 'task_completed'
  data: Record<string, unknown>;
  timestamp: string;
}

interface ProjectEventHandlers {
  onEvent?: (event: ProjectEvent) => void;
  onError?: (source: 'ideation' | 'planner' | 'forge', error: Event) => void;
}

interface ProjectReferences {
  session_id?: string | null;
  plan_id?: string | null;
  run_id?: string | null;
}

interface UseProjectEventsReturn {
  events: ProjectEvent[];
  isConnected: boolean;
  connectedSources: Set<'ideation' | 'planner' | 'forge'>;
  clearEvents: () => void;
  reconnect: () => void;
}

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Subscribe to all available SSE streams for a project.
 *
 * @param project - Project references (session_id, plan_id, run_id)
 * @param handlers - Optional event and error handlers
 * @returns Connection status, events, and control functions
 */
export function useProjectEvents(
  project: ProjectReferences | null,
  handlers?: ProjectEventHandlers
): UseProjectEventsReturn {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [connectedSources, setConnectedSources] = useState<Set<'ideation' | 'planner' | 'forge'>>(new Set());

  const sourcesRef = useRef<Map<'ideation' | 'planner' | 'forge', EventSource>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const handlersRef = useRef(handlers);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const isConnected = connectedSources.size > 0;

  const addEvent = useCallback((event: ProjectEvent) => {
    setEvents(prev => [...prev, event]);
    handlersRef.current?.onEvent?.(event);
  }, []);

  const handleSourceOpen = useCallback((source: 'ideation' | 'planner' | 'forge') => {
    console.log(`[useProjectEvents] ${source} SSE connection opened`);
    setConnectedSources(prev => new Set(prev).add(source));
    reconnectAttemptsRef.current.set(source, 0);
  }, []);

  // Ref to break circular dependency: handleSourceError needs connect, connect needs handleSourceError
  const connectRef = useRef<(source: 'ideation' | 'planner' | 'forge', url: string) => void>(() => {});

  const handleSourceError = useCallback((source: 'ideation' | 'planner' | 'forge', url: string, err: Event) => {
    console.error(`[useProjectEvents] ${source} SSE error:`, err);

    // Remove from connected sources
    setConnectedSources(prev => {
      const next = new Set(prev);
      next.delete(source);
      return next;
    });

    handlersRef.current?.onError?.(source, err);

    // Close and cleanup
    const eventSource = sourcesRef.current.get(source);
    if (eventSource) {
      eventSource.close();
      sourcesRef.current.delete(source);
    }

    // Attempt reconnection with exponential backoff
    const attempts = reconnectAttemptsRef.current.get(source) || 0;
    if (attempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttemptsRef.current.set(source, attempts + 1);
      const delay = RECONNECT_DELAY * Math.min(attempts + 1, 3);
      console.log(`[useProjectEvents] ${source} reconnecting in ${delay}ms (attempt ${attempts + 1})`);

      const timeoutId = setTimeout(() => {
        reconnectTimeoutsRef.current.delete(source);
        connectRef.current(source, url);
      }, delay);

      reconnectTimeoutsRef.current.set(source, timeoutId);
    } else {
      console.error(`[useProjectEvents] ${source} max reconnect attempts reached`);
    }
  }, []);

  const connect = useCallback((source: 'ideation' | 'planner' | 'forge', url: string) => {
    // Close existing connection if any
    const existing = sourcesRef.current.get(source);
    if (existing) {
      existing.close();
      sourcesRef.current.delete(source);
    }

    console.log(`[useProjectEvents] Connecting to ${source} SSE: ${url}`);

    const eventSource = new EventSource(url);
    sourcesRef.current.set(source, eventSource);

    eventSource.onopen = () => handleSourceOpen(source);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: ProjectEvent = {
          type: source,
          event: data.type || data.event || 'unknown',
          data,
          timestamp: new Date().toISOString(),
        };
        addEvent(event);
      } catch (err) {
        console.error(`[useProjectEvents] ${source} parse error:`, err);
      }
    };

    eventSource.onerror = (err) => handleSourceError(source, url, err);

    // Handle specific event types for different sources
    if (source === 'planner') {
      eventSource.addEventListener('plan_change', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const event: ProjectEvent = {
            type: 'planner',
            event: 'plan_change',
            data,
            timestamp: new Date().toISOString(),
          };
          addEvent(event);
        } catch (err) {
          console.error('[useProjectEvents] planner plan_change parse error:', err);
        }
      });
    }

    if (source === 'forge') {
      eventSource.addEventListener('trajectory', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const event: ProjectEvent = {
            type: 'forge',
            event: data.event_type || 'trajectory',
            data,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          addEvent(event);
        } catch (err) {
          console.error('[useProjectEvents] forge trajectory parse error:', err);
        }
      });
    }
  }, [addEvent, handleSourceOpen, handleSourceError]);

  // Keep connectRef in sync so handleSourceError always uses the latest connect
  connectRef.current = connect;

  const cleanup = useCallback(() => {
    // Close all connections
    sourcesRef.current.forEach((source, key) => {
      console.log(`[useProjectEvents] Closing ${key} SSE connection`);
      source.close();
    });
    sourcesRef.current.clear();

    // Clear reconnect timeouts
    reconnectTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    reconnectTimeoutsRef.current.clear();

    // Clear reconnect attempts
    reconnectAttemptsRef.current.clear();

    // Reset connected sources
    setConnectedSources(new Set());
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const reconnect = useCallback(() => {
    cleanup();

    // Reconnect to available sources
    if (project?.session_id) {
      connect('ideation', `/api/ideation/sessions/${project.session_id}/events`);
    }
    if (project?.plan_id) {
      connect('planner', `/api/plans/${project.plan_id}/events`);
    }
    if (project?.run_id) {
      connect('forge', `/api/forge/runs/${project.run_id}/events`);
    }
  }, [project, cleanup, connect]);

  // Subscribe to available streams when project references change
  useEffect(() => {
    if (!project) {
      cleanup();
      return;
    }

    // Subscribe to ideation events if session_id exists
    if (project.session_id) {
      connect('ideation', `/api/ideation/sessions/${project.session_id}/events`);
    }

    // Subscribe to planner events if plan_id exists
    if (project.plan_id) {
      connect('planner', `/api/plans/${project.plan_id}/events`);
    }

    // Subscribe to forge events if run_id exists
    if (project.run_id) {
      connect('forge', `/api/forge/runs/${project.run_id}/events`);
    }

    return cleanup;
  }, [project?.session_id, project?.plan_id, project?.run_id, connect, cleanup]);

  return {
    events,
    isConnected,
    connectedSources,
    clearEvents,
    reconnect,
  };
}
