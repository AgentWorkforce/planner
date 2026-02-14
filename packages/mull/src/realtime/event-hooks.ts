/**
 * Event Hooks for Real-Time Trigger System
 *
 * Registers event listeners on forge TrajectoryCapture and RetrospectiveService
 * to trigger mull extraction in response to high-signal events.
 *
 * This module bridges the gap between forge's event sources and mull's
 * TriggerManager, enabling real-time knowledge accumulation without polling.
 */

import type { TriggerManager } from './trigger-manager.js';
import type { ForgeTrajectoryEvent, TriggerConfig } from './types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RegisterTriggersConfig {
  /** The TriggerManager instance to wire up */
  triggerManager: TriggerManager;

  /** Whether triggers are enabled (if false, returns no-op cleanup) */
  enabled: boolean;

  /** Optional TrajectoryCapture instance from forge */
  trajectoryCapture?: {
    on(event: 'trajectory', handler: (event: {
      event_id: string;
      run_id: string;
      task_id?: string;
      event_type: string;
      payload: Record<string, unknown>;
      timestamp: string;
    }) => void): void;
    removeListener(event: 'trajectory', handler: (event: {
      event_id: string;
      run_id: string;
      task_id?: string;
      event_type: string;
      payload: Record<string, unknown>;
      timestamp: string;
    }) => void): void;
  };

  /** Optional RetrospectiveService instance from forge */
  retrospectiveService?: {
    on(event: 'retrospective_recorded', handler: (event: {
      taskId: string;
      agentId: string;
      retrospective: unknown;
      eventId: string;
    }) => void): void;
    removeListener(event: 'retrospective_recorded', handler: (event: {
      taskId: string;
      agentId: string;
      retrospective: unknown;
      eventId: string;
    }) => void): void;
  };
}

// ---------------------------------------------------------------------------
// Cleanup Function Type
// ---------------------------------------------------------------------------

export type TriggerCleanupFn = () => void;

// ---------------------------------------------------------------------------
// Registration Function
// ---------------------------------------------------------------------------

/**
 * Registers real-time trigger hooks on forge event sources.
 *
 * Hooks into:
 * - TrajectoryCapture.on('trajectory') — filters high-signal events, triggers deterministic + LLM
 * - RetrospectiveService.on('retrospective_recorded') — triggers both deterministic + LLM
 *
 * @param config - Configuration with trigger manager and event sources
 * @returns A cleanup function that removes all registered listeners
 *
 * @example
 * ```typescript
 * const cleanup = registerMullTriggers({
 *   triggerManager,
 *   enabled: true,
 *   trajectoryCapture: forgeService.getTrajectoryCapture(),
 *   retrospectiveService: forgeService.getRetrospectiveService(),
 * });
 *
 * // Later, on shutdown:
 * cleanup();
 * ```
 */
export function registerMullTriggers(config: RegisterTriggersConfig): TriggerCleanupFn {
  const { triggerManager, enabled, trajectoryCapture, retrospectiveService } = config;

  // If triggers are disabled, return no-op cleanup immediately
  if (!enabled) {
    console.log('[mull:triggers] Triggers disabled via config — no event hooks registered');
    return () => {
      // No-op cleanup
    };
  }

  const handlers: Array<() => void> = [];

  // ---------------------------------------------------------------------------
  // Trajectory Event Hook
  // ---------------------------------------------------------------------------

  if (trajectoryCapture) {
    const trajectoryHandler = (event: {
      event_id: string;
      run_id: string;
      task_id?: string;
      event_type: string;
      payload: Record<string, unknown>;
      timestamp: string;
    }): void => {
      // Convert forge TrajectoryEvent to ForgeTrajectoryEvent format
      const forgeEvent: ForgeTrajectoryEvent = {
        event_id: event.event_id,
        run_id: event.run_id,
        task_id: event.task_id,
        event_type: event.event_type,
        payload: event.payload,
        timestamp: event.timestamp,
      };

      // Fire-and-forget: trigger manager handles errors internally
      triggerManager.onForgeEvent(forgeEvent).catch((err) => {
        console.error('[mull:triggers] Error processing trajectory event:', err);
      });
    };

    trajectoryCapture.on('trajectory', trajectoryHandler);
    handlers.push(() => {
      trajectoryCapture.removeListener('trajectory', trajectoryHandler);
    });

    console.log('[mull:triggers] Registered trajectory event hook');
  }

  // ---------------------------------------------------------------------------
  // Retrospective Event Hook
  // ---------------------------------------------------------------------------

  if (retrospectiveService) {
    const retrospectiveHandler = (event: {
      taskId: string;
      agentId: string;
      retrospective: unknown;
      eventId: string;
    }): void => {
      // Retrospectives are high-signal decision-type events
      // We create a synthetic ForgeTrajectoryEvent to trigger the manager
      const forgeEvent: ForgeTrajectoryEvent = {
        event_id: event.eventId,
        run_id: event.taskId, // sessionId derived from taskId (TriggerManager resolves to run_id)
        task_id: event.taskId,
        event_type: 'retrospective_recorded',
        payload: {
          agent_id: event.agentId,
          retrospective: event.retrospective,
        },
        timestamp: new Date().toISOString(),
      };

      // Fire-and-forget: trigger manager handles errors internally
      triggerManager.onForgeEvent(forgeEvent).catch((err) => {
        console.error('[mull:triggers] Error processing retrospective event:', err);
      });
    };

    retrospectiveService.on('retrospective_recorded', retrospectiveHandler);
    handlers.push(() => {
      retrospectiveService.removeListener('retrospective_recorded', retrospectiveHandler);
    });

    console.log('[mull:triggers] Registered retrospective event hook');
  }

  // ---------------------------------------------------------------------------
  // Start Timer (if enabled)
  // ---------------------------------------------------------------------------

  triggerManager.startTimer();
  console.log('[mull:triggers] Trigger timer started');

  // ---------------------------------------------------------------------------
  // Cleanup Function
  // ---------------------------------------------------------------------------

  return () => {
    console.log('[mull:triggers] Cleaning up event hooks...');
    for (const cleanup of handlers) {
      cleanup();
    }
    triggerManager.shutdown();
    console.log('[mull:triggers] All hooks removed, timer stopped');
  };
}
