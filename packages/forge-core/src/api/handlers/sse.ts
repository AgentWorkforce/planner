import type { Request, Response } from 'express';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import type { ForgeStorage } from '../../storage/interface.js';
import type { TrajectoryEvent } from '../../domain/types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import { RunSSEEventTypes } from '../schemas.js';

// ============================================
// SSE Event Types
// ============================================

/**
 * SSE event names for gate-related notifications.
 */
export const GateSSEEvents = {
  GateReached: 'gate_reached',
  GateApproved: 'gate_approved',
  GateRejected: 'gate_rejected',
} as const;

export type GateSSEEvent = (typeof GateSSEEvents)[keyof typeof GateSSEEvents];

/**
 * Payload for gate_reached SSE event.
 */
export interface GateReachedSSEPayload {
  gate_id: string;
  task_id: string;
  task_title: string;
  approver_role?: string;
}

/**
 * Payload for gate_approved SSE event.
 */
export interface GateApprovedSSEPayload {
  gate_id: string;
  task_id: string;
  task_title: string;
  approved_by?: string;
  comment?: string;
}

/**
 * Payload for gate_rejected SSE event.
 */
export interface GateRejectedSSEPayload {
  gate_id: string;
  task_id: string;
  task_title: string;
  rejected_by?: string;
  reason?: string;
  comment?: string;
}

/**
 * Full run events SSE dependencies.
 */
export interface RunEventsSSEDeps {
  trajectoryCapture: TrajectoryCapture;
  storage?: ForgeStorage;
}

// ============================================
// SSE Handler
// ============================================

/**
 * Event ID counter for SSE Last-Event-ID support.
 * Each instance maintains its own counter.
 */
let eventIdCounter = 0;

/**
 * Generates a unique event ID for SSE reconnection support.
 */
function generateEventId(): string {
  return `${Date.now()}-${++eventIdCounter}`;
}

/**
 * Trajectory event types to SSE event type mapping.
 */
const TRAJECTORY_TO_SSE_EVENT: Record<string, string> = {
  // Run events
  [TrajectoryEventType.RunStarted]: RunSSEEventTypes.RunStatusChanged,
  [TrajectoryEventType.RunCompleted]: RunSSEEventTypes.RunStatusChanged,
  [TrajectoryEventType.RunFailed]: RunSSEEventTypes.RunStatusChanged,
  [TrajectoryEventType.RunPaused]: RunSSEEventTypes.RunStatusChanged,
  [TrajectoryEventType.RunResumed]: RunSSEEventTypes.RunStatusChanged,
  [TrajectoryEventType.RunCancelled]: RunSSEEventTypes.RunStatusChanged,
  // Task events
  [TrajectoryEventType.TaskStarted]: RunSSEEventTypes.TaskStatusChanged,
  [TrajectoryEventType.TaskCompleted]: RunSSEEventTypes.TaskStatusChanged,
  [TrajectoryEventType.TaskFailed]: RunSSEEventTypes.TaskStatusChanged,
  [TrajectoryEventType.TaskBlocked]: RunSSEEventTypes.TaskStatusChanged,
  [TrajectoryEventType.TaskQueued]: RunSSEEventTypes.TaskStatusChanged,
  [TrajectoryEventType.TaskRetrying]: RunSSEEventTypes.TaskStatusChanged,
  // Gate events
  [TrajectoryEventType.GateReached]: RunSSEEventTypes.GateReached,
  [TrajectoryEventType.GateApproved]: RunSSEEventTypes.TaskStatusChanged, // Gate approval changes task status
  [TrajectoryEventType.GateRejected]: RunSSEEventTypes.TaskStatusChanged, // Gate rejection changes task status
  // Agent events
  [TrajectoryEventType.AgentProgress]: RunSSEEventTypes.AgentProgress,
  // Question events
  [TrajectoryEventType.HumanInputRequested]: RunSSEEventTypes.QuestionAdded,
  // AC Audit events
  [TrajectoryEventType.RunAcAuditStarted]: RunSSEEventTypes.AcAuditComplete,
  [TrajectoryEventType.RunAcAuditCompleted]: RunSSEEventTypes.AcAuditComplete,
};

/**
 * Supported trajectory event types for run events stream.
 */
const SUPPORTED_RUN_EVENT_TYPES = Object.keys(TRAJECTORY_TO_SSE_EVENT);

/**
 * Creates an SSE handler for run events.
 *
 * This handler streams events for a specific run via Server-Sent Events.
 * It streams: run_status_changed, task_status_changed, gate_reached, agent_progress, question_added.
 *
 * Route: GET /runs/:id/events
 *
 * Supports Last-Event-ID header for reconnection - will replay events since the last received event.
 *
 * @param trajectoryCapture - TrajectoryCapture service to subscribe to events
 * @deprecated Use fullRunEventsSSEHandler for complete event support
 */
export function runEventsSSEHandler(trajectoryCapture: TrajectoryCapture) {
  return (req: Request, res: Response): void => {
    const runId = req.params.id as string;

    if (!runId) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Flush headers to establish connection
    res.flushHeaders();

    // Send initial connection message
    sendSSEMessage(res, 'connected', { run_id: runId });

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      sendSSEMessage(res, 'heartbeat', { timestamp: new Date().toISOString() });
    }, 30000); // Every 30 seconds

    // Handler for trajectory events
    const handleTrajectoryEvent = (event: TrajectoryEvent) => {
      // Only forward events for this run
      if (event.run_id !== runId) {
        return;
      }

      // Filter for gate events
      const gateEventTypes: string[] = [
        TrajectoryEventType.GateReached,
        TrajectoryEventType.GateApproved,
        TrajectoryEventType.GateRejected,
      ];

      if (!gateEventTypes.includes(event.event_type)) {
        return;
      }

      // Map trajectory event to SSE payload
      const payload = event.payload as Record<string, unknown>;
      const ssePayload = {
        gate_id: payload.gate_id,
        task_id: event.task_id,
        task_title: payload.step_title,
        ...extractGateSpecificFields(event.event_type, payload),
      };

      // Send SSE event
      sendSSEMessage(res, event.event_type, ssePayload);
    };

    // Subscribe to trajectory events
    trajectoryCapture.on('trajectory', handleTrajectoryEvent);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      trajectoryCapture.off('trajectory', handleTrajectoryEvent);
    });

    // Handle errors
    req.on('error', (err) => {
      console.error('[SSE] Connection error:', err);
      clearInterval(heartbeatInterval);
      trajectoryCapture.off('trajectory', handleTrajectoryEvent);
    });
  };
}

/**
 * Creates a full SSE handler for run events that supports all event types.
 *
 * This handler streams all relevant events for a run via Server-Sent Events:
 * - run_status_changed: When run status changes
 * - task_status_changed: When any task status changes
 * - gate_reached: When a task reaches a human approval gate
 * - agent_progress: Progress updates from agents
 * - question_added: When an agent asks a question
 *
 * Route: GET /runs/:id/events
 *
 * Supports Last-Event-ID header for reconnection - will replay missed events.
 *
 * @param deps - Dependencies including trajectoryCapture and optional storage
 */
export function fullRunEventsSSEHandler(deps: RunEventsSSEDeps) {
  return (req: Request, res: Response): void => {
    const runId = req.params.id as string;

    if (!runId) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Flush headers to establish connection
    res.flushHeaders();

    // Check for Last-Event-ID for reconnection support
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    let lastEventTimestamp: string | undefined;

    if (lastEventId) {
      // Parse timestamp from event ID (format: timestamp-counter)
      const timestampStr = lastEventId.split('-')[0];
      if (timestampStr) {
        const timestamp = parseInt(timestampStr, 10);
        if (!isNaN(timestamp)) {
          lastEventTimestamp = new Date(timestamp).toISOString();
        }
      }
    }

    // Send initial connection message with event ID
    sendSSEMessageWithId(res, generateEventId(), RunSSEEventTypes.Connected, { run_id: runId });

    // If we have storage and a last event ID, replay missed events
    if (deps.storage && lastEventTimestamp) {
      try {
        const missedEvents = deps.storage.listTrajectoryEvents(runId, {
          from_timestamp: lastEventTimestamp,
        });

        for (const event of missedEvents) {
          if (SUPPORTED_RUN_EVENT_TYPES.includes(event.event_type)) {
            const sseEventType = TRAJECTORY_TO_SSE_EVENT[event.event_type];
            if (sseEventType) {
              const ssePayload = mapTrajectoryToSSEPayload(event);
              sendSSEMessageWithId(res, generateEventId(), sseEventType, ssePayload);
            }
          }
        }
      } catch (err) {
        console.error('[SSE] Error replaying missed events:', err);
        // Continue without replay - not fatal
      }
    }

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      sendSSEMessageWithId(res, generateEventId(), RunSSEEventTypes.Heartbeat, {
        timestamp: new Date().toISOString(),
      });
    }, 30000); // Every 30 seconds

    // Handler for trajectory events
    const handleTrajectoryEvent = (event: TrajectoryEvent) => {
      // Only forward events for this run
      if (event.run_id !== runId) {
        return;
      }

      // Check if this event type is supported
      if (!SUPPORTED_RUN_EVENT_TYPES.includes(event.event_type)) {
        return;
      }

      const sseEventType = TRAJECTORY_TO_SSE_EVENT[event.event_type];
      if (!sseEventType) {
        return;
      }

      // Map trajectory event to SSE payload
      const ssePayload = mapTrajectoryToSSEPayload(event);

      // Send SSE event with ID for reconnection support
      sendSSEMessageWithId(res, generateEventId(), sseEventType, ssePayload);
    };

    // Subscribe to trajectory events
    deps.trajectoryCapture.on('trajectory', handleTrajectoryEvent);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      deps.trajectoryCapture.off('trajectory', handleTrajectoryEvent);
    });

    // Handle errors
    req.on('error', (err) => {
      console.error('[SSE] Connection error:', err);
      clearInterval(heartbeatInterval);
      deps.trajectoryCapture.off('trajectory', handleTrajectoryEvent);
    });
  };
}

/**
 * Creates an SSE handler that streams all gate events (not filtered by run).
 *
 * Useful for dashboard views that need to see all pending gates.
 *
 * Route: GET /gates/events
 *
 * @param trajectoryCapture - TrajectoryCapture service to subscribe to events
 */
export function gateEventsSSEHandler(trajectoryCapture: TrajectoryCapture) {
  return (req: Request, res: Response): void => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Flush headers to establish connection
    res.flushHeaders();

    // Send initial connection message
    sendSSEMessage(res, 'connected', { scope: 'all_gates' });

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      sendSSEMessage(res, 'heartbeat', { timestamp: new Date().toISOString() });
    }, 30000);

    // Handler for trajectory events
    const handleTrajectoryEvent = (event: TrajectoryEvent) => {
      // Filter for gate events only
      const gateEventTypes: string[] = [
        TrajectoryEventType.GateReached,
        TrajectoryEventType.GateApproved,
        TrajectoryEventType.GateRejected,
      ];

      if (!gateEventTypes.includes(event.event_type)) {
        return;
      }

      // Map trajectory event to SSE payload
      const payload = event.payload as Record<string, unknown>;
      const ssePayload = {
        run_id: event.run_id,
        gate_id: payload.gate_id,
        task_id: event.task_id,
        task_title: payload.step_title,
        ...extractGateSpecificFields(event.event_type, payload),
      };

      // Send SSE event
      sendSSEMessage(res, event.event_type, ssePayload);
    };

    // Subscribe to trajectory events
    trajectoryCapture.on('trajectory', handleTrajectoryEvent);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      trajectoryCapture.off('trajectory', handleTrajectoryEvent);
    });

    // Handle errors
    req.on('error', (err) => {
      console.error('[SSE] Connection error:', err);
      clearInterval(heartbeatInterval);
      trajectoryCapture.off('trajectory', handleTrajectoryEvent);
    });
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Sends an SSE message to the client without event ID.
 */
function sendSSEMessage(res: Response, event: string, data: Record<string, unknown>): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(message);
}

/**
 * Sends an SSE message with event ID for reconnection support.
 */
function sendSSEMessageWithId(
  res: Response,
  id: string,
  event: string,
  data: Record<string, unknown>
): void {
  const message = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(message);
}

/**
 * Maps a trajectory event to SSE payload format.
 */
function mapTrajectoryToSSEPayload(event: TrajectoryEvent): Record<string, unknown> {
  const payload = event.payload as Record<string, unknown>;
  const basePayload: Record<string, unknown> = {
    event_type: event.event_type,
    timestamp: event.timestamp,
  };

  if (event.task_id) {
    basePayload.task_id = event.task_id;
  }

  // Add event-specific fields based on event type
  switch (event.event_type) {
    // Run events
    case TrajectoryEventType.RunStarted:
      return {
        ...basePayload,
        status: 'running',
        plan_id: payload.plan_id,
        plan_version: payload.plan_version,
        goal: payload.goal,
      };

    case TrajectoryEventType.RunCompleted:
      return {
        ...basePayload,
        status: 'completed',
        duration_ms: payload.duration_ms,
        tasks_completed: payload.tasks_completed,
        tasks_total: payload.tasks_total,
      };

    case TrajectoryEventType.RunFailed:
      return {
        ...basePayload,
        status: 'failed',
        error: payload.error,
        failed_task_id: payload.failed_task_id,
      };

    case TrajectoryEventType.RunPaused:
      return {
        ...basePayload,
        status: 'paused',
        reason: payload.reason,
        pending_gate_id: payload.pending_gate_id,
      };

    case TrajectoryEventType.RunResumed:
      return {
        ...basePayload,
        status: 'running',
        resumed_by: payload.resumed_by,
        previous_status: payload.previous_status,
      };

    case TrajectoryEventType.RunCancelled:
      return {
        ...basePayload,
        status: 'cancelled',
        reason: payload.reason,
        cancelled_by: payload.cancelled_by,
      };

    // Task events
    case TrajectoryEventType.TaskStarted:
      return {
        ...basePayload,
        status: 'running',
        step_id: payload.step_id,
        step_title: payload.step_title,
        attempt_number: payload.attempt_number,
        agent_id: payload.agent_id,
      };

    case TrajectoryEventType.TaskCompleted:
      return {
        ...basePayload,
        status: 'completed',
        step_id: payload.step_id,
        step_title: payload.step_title,
        attempt_number: payload.attempt_number,
        duration_ms: payload.duration_ms,
      };

    case TrajectoryEventType.TaskFailed:
      return {
        ...basePayload,
        status: 'failed',
        step_id: payload.step_id,
        step_title: payload.step_title,
        attempt_number: payload.attempt_number,
        error: payload.error,
        will_retry: payload.will_retry,
      };

    case TrajectoryEventType.TaskBlocked:
      return {
        ...basePayload,
        status: 'blocked',
        step_id: payload.step_id,
        step_title: payload.step_title,
        blocked_by: payload.blocked_by,
        reason: payload.reason,
      };

    case TrajectoryEventType.TaskQueued:
      return {
        ...basePayload,
        status: 'queued',
        step_id: payload.step_id,
        step_title: payload.step_title,
      };

    case TrajectoryEventType.TaskRetrying:
      return {
        ...basePayload,
        status: 'retrying',
        step_id: payload.step_id,
        step_title: payload.step_title,
        previous_attempt: payload.previous_attempt,
        next_attempt: payload.next_attempt,
        previous_error: payload.previous_error,
      };

    // Gate events
    case TrajectoryEventType.GateReached:
      return {
        ...basePayload,
        gate_id: payload.gate_id,
        step_id: payload.step_id,
        step_title: payload.step_title,
        approver_role: payload.approver_role,
      };

    case TrajectoryEventType.GateApproved:
      return {
        ...basePayload,
        status: 'completed',
        gate_id: payload.gate_id,
        step_id: payload.step_id,
        step_title: payload.step_title,
        approved_by: payload.approved_by,
        comment: payload.comment,
      };

    case TrajectoryEventType.GateRejected:
      return {
        ...basePayload,
        status: 'failed',
        gate_id: payload.gate_id,
        step_id: payload.step_id,
        step_title: payload.step_title,
        rejected_by: payload.rejected_by,
        reason: payload.reason,
        comment: payload.comment,
      };

    // Agent events
    case TrajectoryEventType.AgentProgress:
      return {
        ...basePayload,
        agent_id: payload.agent_id,
        message: payload.message,
        progress_pct: payload.progress_pct,
        current_action: payload.current_action,
      };

    // Question events
    case TrajectoryEventType.HumanInputRequested:
      return {
        ...basePayload,
        question_id: payload.question_id,
        agent_id: payload.agent_id,
        text: payload.text,
        blocking_level: payload.blocking_level,
        options: payload.options,
      };

    // AC Audit events
    case TrajectoryEventType.RunAcAuditStarted:
    case TrajectoryEventType.RunAcAuditCompleted:
      return {
        run_id: event.run_id,
        event_type: event.event_type,
        ...payload,
        timestamp: event.timestamp,
      };

    default:
      return {
        ...basePayload,
        ...payload,
      };
  }
}

/**
 * Extracts event-type-specific fields from the trajectory payload.
 */
function extractGateSpecificFields(
  eventType: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  switch (eventType) {
    case TrajectoryEventType.GateReached:
      return {
        approver_role: payload.approver_role,
      };
    case TrajectoryEventType.GateApproved:
      return {
        approved_by: payload.approved_by,
        comment: payload.comment,
      };
    case TrajectoryEventType.GateRejected:
      return {
        rejected_by: payload.rejected_by,
        reason: payload.reason,
        comment: payload.comment,
      };
    default:
      return {};
  }
}

// ============================================
// Export handler types
// ============================================

export type RunEventsSSEHandlerFn = ReturnType<typeof runEventsSSEHandler>;
export type FullRunEventsSSEHandlerFn = ReturnType<typeof fullRunEventsSSEHandler>;
export type GateEventsSSEHandlerFn = ReturnType<typeof gateEventsSSEHandler>;
