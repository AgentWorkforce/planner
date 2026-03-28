/**
 * useProjectEvents Hook
 *
 * Composes multiple SSE streams based on project phase.
 * Subscribes to ideation, planner, and forge events as appropriate.
 */

import { useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = '/api';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

/** Project entity from planner domain */
interface Project {
  id: string;
  name: string;
  owner_id: string | null;
  initiative_id: string | null;
  session_id: string | null;
  plan_id: string | null;
  run_id: string | null;
  config: Record<string, unknown> | null;
  current_focus: string | null;
  created_at: string;
  updated_at: string;
}

/** Event callbacks for different domains */
interface ProjectEvents {
  // Events from ideation SSE (/api/ideation/sessions/:id/events)
  onTranscript?: (messages: unknown[]) => void;
  onUnderstanding?: (understanding: Record<string, Record<string, unknown>>) => void;
  onBlockUpdate?: (block: unknown) => void;
  onBlocksGraduated?: () => void;
  onStatus?: (status: 'active' | 'abandoned') => void;
  onConfidence?: (score: number, breakdown: Record<string, string>) => void;

  // Events from planner SSE (/api/plans/:id/events)
  onPlanChange?: (event: { version: number; changeType: string; stepId?: string; timestamp: string }) => void;

  // Events from forge SSE (/api/forge/runs/:id/events)
  onRunProgress?: (progress: unknown) => void;
  onAgentUpdate?: (agent: unknown) => void;
  onGateEvent?: (gate: unknown) => void;
  onTaskUpdate?: (task: unknown) => void;
}

/**
 * Subscribe to project events via SSE based on project phase.
 *
 * - When project.session_id exists → subscribe to ideation events
 * - When project.plan_id exists → subscribe to planner events
 * - When project.run_id exists → subscribe to forge events
 *
 * @param project - Project entity with linked resource IDs
 * @param callbacks - Event handlers for different event types
 * @returns Connection status
 */
export function useProjectEvents(
  project: Project | null,
  callbacks: ProjectEvents
): { connected: boolean } {
  const handlersRef = useRef(callbacks);
  const ideationSourceRef = useRef<EventSource | null>(null);
  const plannerSourceRef = useRef<EventSource | null>(null);
  const forgeSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutsRef = useRef<{
    ideation?: ReturnType<typeof setTimeout>;
    planner?: ReturnType<typeof setTimeout>;
    forge?: ReturnType<typeof setTimeout>;
  }>({});
  const reconnectAttemptsRef = useRef<{
    ideation: number;
    planner: number;
    forge: number;
  }>({ ideation: 0, planner: 0, forge: 0 });

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = callbacks;
  }, [callbacks]);

  // Ideation SSE connection
  const connectIdeation = useCallback((sessionId: string) => {
    if (ideationSourceRef.current) {
      ideationSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/ideation/sessions/${sessionId}/events`;
    console.log(`[useProjectEvents] Connecting to ideation SSE: ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useProjectEvents] Ideation SSE connected for session ${sessionId}`);
      reconnectAttemptsRef.current.ideation = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[useProjectEvents] Ideation event: ${data.type}`);

        switch (data.type) {
          case 'ping':
            break;
          case 'transcript_updated':
            handlersRef.current.onTranscript?.(data.transcript);
            break;
          case 'understanding_updated':
            handlersRef.current.onUnderstanding?.(data.understanding);
            break;
          case 'block_update':
            handlersRef.current.onBlockUpdate?.(data.block);
            break;
          case 'session:blocks_graduated':
            handlersRef.current.onBlocksGraduated?.();
            break;
          case 'status_changed':
            handlersRef.current.onStatus?.(data.status);
            break;
          case 'confidence_changed':
            handlersRef.current.onConfidence?.(data.score, data.breakdown);
            break;
          default:
            console.log(`[useProjectEvents] Unknown ideation event: ${data.type}`);
        }
      } catch (err) {
        console.error(`[useProjectEvents] Ideation parse error:`, err);
      }
    };

    eventSource.onerror = () => {
      console.error(`[useProjectEvents] Ideation SSE error`);
      eventSource.close();

      if (reconnectAttemptsRef.current.ideation < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current.ideation++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current.ideation, 3);
        console.log(`[useProjectEvents] Ideation reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current.ideation})`);
        reconnectTimeoutsRef.current.ideation = setTimeout(() => {
          connectIdeation(sessionId);
        }, delay);
      } else {
        console.error(`[useProjectEvents] Ideation max reconnect attempts reached`);
      }
    };

    ideationSourceRef.current = eventSource;
  }, []);

  // Planner SSE connection
  const connectPlanner = useCallback((planId: string) => {
    if (plannerSourceRef.current) {
      plannerSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/plans/${planId}/events`;
    console.log(`[useProjectEvents] Connecting to planner SSE: ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useProjectEvents] Planner SSE connected for plan ${planId}`);
      reconnectAttemptsRef.current.planner = 0;
    };

    eventSource.addEventListener('plan_change', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onPlanChange?.(data);
      } catch (err) {
        console.error(`[useProjectEvents] Planner parse error:`, err);
      }
    });

    eventSource.onerror = () => {
      console.error(`[useProjectEvents] Planner SSE error`);
      eventSource.close();

      if (reconnectAttemptsRef.current.planner < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current.planner++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current.planner, 3);
        console.log(`[useProjectEvents] Planner reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current.planner})`);
        reconnectTimeoutsRef.current.planner = setTimeout(() => {
          connectPlanner(planId);
        }, delay);
      } else {
        console.error(`[useProjectEvents] Planner max reconnect attempts reached`);
      }
    };

    plannerSourceRef.current = eventSource;
  }, []);

  // Forge SSE connection
  const connectForge = useCallback((runId: string) => {
    if (forgeSourceRef.current) {
      forgeSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/forge/runs/${runId}/events`;
    console.log(`[useProjectEvents] Connecting to forge SSE: ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useProjectEvents] Forge SSE connected for run ${runId}`);
      reconnectAttemptsRef.current.forge = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[useProjectEvents] Forge event: ${data.type}`);

        switch (data.type) {
          case 'run_progress':
            handlersRef.current.onRunProgress?.(data);
            break;
          case 'agent_update':
            handlersRef.current.onAgentUpdate?.(data);
            break;
          case 'gate_event':
            handlersRef.current.onGateEvent?.(data);
            break;
          case 'task_update':
            handlersRef.current.onTaskUpdate?.(data);
            break;
          default:
            console.log(`[useProjectEvents] Unknown forge event: ${data.type}`);
        }
      } catch (err) {
        console.error(`[useProjectEvents] Forge parse error:`, err);
      }
    };

    eventSource.onerror = () => {
      console.error(`[useProjectEvents] Forge SSE error`);
      eventSource.close();

      if (reconnectAttemptsRef.current.forge < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current.forge++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current.forge, 3);
        console.log(`[useProjectEvents] Forge reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current.forge})`);
        reconnectTimeoutsRef.current.forge = setTimeout(() => {
          connectForge(runId);
        }, delay);
      } else {
        console.error(`[useProjectEvents] Forge max reconnect attempts reached`);
      }
    };

    forgeSourceRef.current = eventSource;
  }, []);

  // Effect to manage connections based on project state
  useEffect(() => {
    if (!project) return;

    // Connect to ideation if session_id exists
    if (project.session_id) {
      connectIdeation(project.session_id);
    } else {
      ideationSourceRef.current?.close();
      ideationSourceRef.current = null;
      if (reconnectTimeoutsRef.current.ideation) {
        clearTimeout(reconnectTimeoutsRef.current.ideation);
      }
    }

    // Connect to planner if plan_id exists
    if (project.plan_id) {
      connectPlanner(project.plan_id);
    } else {
      plannerSourceRef.current?.close();
      plannerSourceRef.current = null;
      if (reconnectTimeoutsRef.current.planner) {
        clearTimeout(reconnectTimeoutsRef.current.planner);
      }
    }

    // Connect to forge if run_id exists
    if (project.run_id) {
      connectForge(project.run_id);
    } else {
      forgeSourceRef.current?.close();
      forgeSourceRef.current = null;
      if (reconnectTimeoutsRef.current.forge) {
        clearTimeout(reconnectTimeoutsRef.current.forge);
      }
    }

    return () => {
      ideationSourceRef.current?.close();
      plannerSourceRef.current?.close();
      forgeSourceRef.current?.close();
      if (reconnectTimeoutsRef.current.ideation) {
        clearTimeout(reconnectTimeoutsRef.current.ideation);
      }
      if (reconnectTimeoutsRef.current.planner) {
        clearTimeout(reconnectTimeoutsRef.current.planner);
      }
      if (reconnectTimeoutsRef.current.forge) {
        clearTimeout(reconnectTimeoutsRef.current.forge);
      }
    };
  }, [project, connectIdeation, connectPlanner, connectForge]);

  // Track connection status (at least one source connected)
  const connected = !!(
    ideationSourceRef.current?.readyState === EventSource.OPEN ||
    plannerSourceRef.current?.readyState === EventSource.OPEN ||
    forgeSourceRef.current?.readyState === EventSource.OPEN
  );

  return { connected };
}
