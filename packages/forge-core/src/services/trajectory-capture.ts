import { EventEmitter } from 'events';
import type { ForgeStorage } from '../storage/interface.js';
import type { TrajectoryEvent } from '../domain/types.js';
import { createTrajectoryEvent } from '../domain/types.js';
import {
  type TrajectoryEventType,
  TrajectoryPayloadSchemas,
  safeValidateTrajectoryPayload,
} from '../domain/trajectory-events.js';

// ============================================
// Trajectory Capture Events
// ============================================

/**
 * Events emitted by TrajectoryCapture for SSE subscribers.
 */
export interface TrajectoryCaptureEvents {
  trajectory: (event: TrajectoryEvent) => void;
  error: (error: Error, context: { runId: string; eventType: string }) => void;
}

// Note: TypeScript declaration merging for type-safe event emitter
// The class below extends EventEmitter and provides typed event handling

// ============================================
// TrajectoryCapture Service
// ============================================

/**
 * TrajectoryCapture service captures all execution events as trajectories
 * for replay, debugging, and retrospective analysis.
 *
 * Features:
 * - Validates payloads against Zod schemas for each event type
 * - Stores events via ForgeStorage (non-blocking writes)
 * - Emits 'trajectory' events for SSE subscribers
 * - Supports optional strict validation mode
 */
export class TrajectoryCapture extends EventEmitter {
  private storage: ForgeStorage;
  private strictValidation: boolean;

  /**
   * Creates a new TrajectoryCapture instance.
   *
   * @param storage - ForgeStorage instance for persisting events
   * @param options - Configuration options
   * @param options.strictValidation - If true, throws on invalid payloads. Default: false (logs warning)
   */
  constructor(
    storage: ForgeStorage,
    options: {
      strictValidation?: boolean;
    } = {}
  ) {
    super();
    this.storage = storage;
    this.strictValidation = options.strictValidation ?? false;

    // Prevent unhandled 'error' events from crashing the process
    this.on('error', (err, context) => {
      console.error(`[TrajectoryCapture] ${err.message}`, context);
    });
  }

  /**
   * Captures and stores a trajectory event.
   *
   * @param runId - The run this event belongs to
   * @param eventType - The type of event (from TrajectoryEventType)
   * @param payload - Event-specific payload data
   * @param taskId - Optional task ID if event is task-specific
   * @returns The created TrajectoryEvent, or null if validation failed in non-strict mode
   */
  capture(
    runId: string,
    eventType: TrajectoryEventType,
    payload: Record<string, unknown>,
    taskId?: string
  ): TrajectoryEvent | null {
    // Validate payload against schema
    const validationResult = safeValidateTrajectoryPayload(eventType, payload);

    if (!validationResult.success) {
      const errorMessage = `Invalid payload for event type ${eventType}: ${validationResult.error.message}`;

      if (this.strictValidation) {
        throw new Error(errorMessage);
      }

      // Log warning but continue with the original payload
      console.warn(`[TrajectoryCapture] ${errorMessage}`);
      this.emit('error', new Error(errorMessage), { runId, eventType });
    }

    // Create the trajectory event
    const event = createTrajectoryEvent(runId, eventType, payload, taskId);

    // Store the event (non-blocking - we don't await)
    try {
      this.storage.createTrajectoryEvent(event);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[TrajectoryCapture] Failed to store event: ${error.message}`);
      this.emit('error', error, { runId, eventType });
      // Don't throw - storage errors shouldn't block execution
    }

    // Emit for SSE subscribers
    this.emit('trajectory', event);

    return event;
  }

  /**
   * Captures a tool call from an agent.
   * This is a convenience method for the common agent_tool_call pattern.
   *
   * @param runId - The run this event belongs to
   * @param taskId - The task this tool call is associated with
   * @param agentId - The agent making the tool call
   * @param toolName - Name of the tool being called
   * @param args - Arguments passed to the tool
   * @param result - Optional result from the tool
   * @param durationMs - Optional duration of the tool call in milliseconds
   * @param success - Optional success indicator
   * @returns The created TrajectoryEvent
   */
  captureToolCall(
    runId: string,
    taskId: string,
    agentId: string,
    toolName: string,
    args?: Record<string, unknown>,
    result?: Record<string, unknown>,
    durationMs?: number,
    success?: boolean
  ): TrajectoryEvent | null {
    const payload: Record<string, unknown> = {
      agent_id: agentId,
      tool_name: toolName,
    };

    if (args !== undefined) {
      payload.tool_args = args;
    }
    if (result !== undefined) {
      payload.tool_result = result;
    }
    if (durationMs !== undefined) {
      payload.duration_ms = durationMs;
    }
    if (success !== undefined) {
      payload.success = success;
    }

    return this.capture(runId, 'agent_tool_call' as TrajectoryEventType, payload, taskId);
  }

  /**
   * Captures agent progress update.
   * This is a convenience method for the common agent_progress pattern.
   *
   * @param runId - The run this event belongs to
   * @param taskId - The task this progress is associated with
   * @param agentId - The agent reporting progress
   * @param message - Progress message
   * @param progressPct - Optional progress percentage (0-100)
   * @param currentAction - Optional current action description
   * @returns The created TrajectoryEvent
   */
  captureProgress(
    runId: string,
    taskId: string,
    agentId: string,
    message: string,
    progressPct?: number,
    currentAction?: string
  ): TrajectoryEvent | null {
    const payload: Record<string, unknown> = {
      agent_id: agentId,
      message,
    };

    if (progressPct !== undefined) {
      payload.progress_pct = progressPct;
    }
    if (currentAction !== undefined) {
      payload.current_action = currentAction;
    }

    return this.capture(runId, 'agent_progress' as TrajectoryEventType, payload, taskId);
  }

  /**
   * Captures a decision recorded by an agent.
   * This is a convenience method for the decision_recorded pattern.
   *
   * @param runId - The run this event belongs to
   * @param taskId - The task this decision is associated with
   * @param agentId - The agent making the decision
   * @param decision - The decision made
   * @param reasoning - Optional reasoning for the decision
   * @param alternatives - Optional list of alternatives considered
   * @param context - Optional additional context
   * @returns The created TrajectoryEvent
   */
  captureDecision(
    runId: string,
    taskId: string,
    agentId: string,
    decision: string,
    reasoning?: string,
    alternatives?: string[],
    context?: Record<string, unknown>
  ): TrajectoryEvent | null {
    const payload: Record<string, unknown> = {
      agent_id: agentId,
      decision,
    };

    if (reasoning !== undefined) {
      payload.reasoning = reasoning;
    }
    if (alternatives !== undefined) {
      payload.alternatives = alternatives;
    }
    if (context !== undefined) {
      payload.context = context;
    }

    return this.capture(runId, 'decision_recorded' as TrajectoryEventType, payload, taskId);
  }

  /**
   * Captures audit completion.
   * This is a convenience method for the audit_completed pattern.
   *
   * @param runId - The run this event belongs to
   * @param taskId - The task being audited
   * @param stepId - The step ID
   * @param stepTitle - The step title
   * @param passed - Whether the audit passed
   * @param findings - Optional list of audit findings
   * @param durationMs - Optional duration of the audit
   * @returns The created TrajectoryEvent
   */
  captureAuditResult(
    runId: string,
    taskId: string,
    stepId: string,
    stepTitle: string,
    passed: boolean,
    findings?: Array<{ criterion_id: string; status: 'pass' | 'fail'; details: string }>,
    durationMs?: number
  ): TrajectoryEvent | null {
    const payload: Record<string, unknown> = {
      step_id: stepId,
      step_title: stepTitle,
      passed,
    };

    if (findings !== undefined) {
      payload.findings = findings;
    }
    if (durationMs !== undefined) {
      payload.duration_ms = durationMs;
    }

    return this.capture(runId, 'audit_completed' as TrajectoryEventType, payload, taskId);
  }

  /**
   * Gets all available event type names.
   * Useful for documentation or validation.
   */
  getEventTypes(): string[] {
    return Object.keys(TrajectoryPayloadSchemas);
  }

  /**
   * Checks if a given event type is valid.
   */
  isValidEventType(eventType: string): eventType is TrajectoryEventType {
    return eventType in TrajectoryPayloadSchemas;
  }
}

/**
 * Creates a new TrajectoryCapture instance.
 *
 * @param storage - ForgeStorage instance for persisting events
 * @param options - Configuration options
 * @returns A new TrajectoryCapture instance
 */
export function createTrajectoryCapture(
  storage: ForgeStorage,
  options?: { strictValidation?: boolean }
): TrajectoryCapture {
  return new TrajectoryCapture(storage, options);
}
