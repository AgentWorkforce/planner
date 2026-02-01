/**
 * Plan Event Emitter
 *
 * Provides pub/sub for plan change events, enabling real-time sync
 * between backend modifications and connected UI clients via SSE.
 */

import { EventEmitter } from 'events';

/**
 * Types of plan changes that can be emitted.
 */
export type PlanChangeType =
  | 'step_added'
  | 'step_edited'
  | 'step_removed'
  | 'criteria_added'
  | 'criteria_edited'
  | 'understanding_updated'
  | 'context_updated'
  | 'specification_updated';

/**
 * Data emitted with plan change events.
 */
export interface PlanChangeEvent {
  planId: string;
  version: number;
  changeType: PlanChangeType;
  stepId?: string;
  role?: string;
  domain?: string;
  timestamp: string;
}

/**
 * Callback type for plan change listeners.
 */
export type PlanChangeCallback = (event: PlanChangeEvent) => void;

/**
 * Internal emitter instance.
 * Uses planId as event name for efficient per-plan subscriptions.
 */
const emitter = new EventEmitter();

// Increase max listeners to support many SSE connections
emitter.setMaxListeners(100);

/**
 * Options for emitting a plan change event.
 */
export interface EmitPlanChangeOptions {
  stepId?: string;
  role?: string;
  domain?: string;
}

/**
 * Emit a plan change event to all listeners for the given planId.
 *
 * @param planId - The plan that changed
 * @param version - The new version number after the change
 * @param changeType - Type of change that occurred
 * @param options - Optional additional data (stepId, role, domain)
 */
export function emitPlanChange(
  planId: string,
  version: number,
  changeType: PlanChangeType,
  options?: EmitPlanChangeOptions | string
): void {
  // Support both old signature (stepId as string) and new options object
  const opts: EmitPlanChangeOptions =
    typeof options === 'string' ? { stepId: options } : options ?? {};

  const event: PlanChangeEvent = {
    planId,
    version,
    changeType,
    stepId: opts.stepId,
    role: opts.role,
    domain: opts.domain,
    timestamp: new Date().toISOString(),
  };

  emitter.emit(planId, event);
}

/**
 * Subscribe to plan change events for a specific plan.
 *
 * @param planId - The plan to listen for changes on
 * @param callback - Function called when a change occurs
 */
export function onPlanChange(planId: string, callback: PlanChangeCallback): void {
  emitter.on(planId, callback);
}

/**
 * Unsubscribe from plan change events.
 *
 * @param planId - The plan to stop listening to
 * @param callback - The specific callback to remove
 */
export function offPlanChange(planId: string, callback: PlanChangeCallback): void {
  emitter.off(planId, callback);
}

/**
 * Get the current listener count for a plan (useful for testing/debugging).
 *
 * @param planId - The plan to check
 * @returns Number of listeners for this plan
 */
export function getListenerCount(planId: string): number {
  return emitter.listenerCount(planId);
}
