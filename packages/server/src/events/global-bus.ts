/**
 * GlobalEventBus — cross-session event notifications.
 *
 * Singleton EventEmitter that aggregates significant events from forge-next
 * (build completions, gate requests, questions) for broadcast to all connected
 * tend sessions via SSE. Each event carries enough context for the frontend
 * to render a notification and navigate to the source session.
 */

import { EventEmitter } from 'events';

export interface GlobalEvent {
  type: 'build:completed' | 'build:failed' | 'gate:pending' | 'question:pending';
  /** Ideation session that owns the plan (for navigation + filtering) */
  sourceSessionId: string;
  /** Plan that triggered the event */
  planId: string;
  /** Forge-next run ID */
  runId: string;
  /** Step name (for gate/question events) */
  stepName?: string;
  /** Human-readable one-line summary */
  summary: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Typed event name constant. All global events use this single channel. */
export const GLOBAL_EVENT = 'global' as const;

export const globalEventBus = new EventEmitter();

export function emitGlobal(event: GlobalEvent): void {
  globalEventBus.emit(GLOBAL_EVENT, event);
}

export function onGlobal(listener: (event: GlobalEvent) => void): () => void {
  globalEventBus.on(GLOBAL_EVENT, listener);
  return () => globalEventBus.off(GLOBAL_EVENT, listener);
}
