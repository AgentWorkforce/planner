/**
 * Ideation API - Event Emitter
 *
 * Pub/sub for session changes to support SSE.
 */

import { EventEmitter } from 'events';
import type { Session } from '../domain/index.js';

// =============================================================================
// Event Types
// =============================================================================

export type SessionEventType =
  | 'session:created'
  | 'session:updated'
  | 'session:message'
  | 'session:understanding'
  | 'session:specialist'
  | 'session:planner_send';

export interface SessionEvent {
  type: SessionEventType;
  session_id: string;
  data: Session;
  timestamp: string;
}

// =============================================================================
// Event Emitter Singleton
// =============================================================================

class IdeationEventEmitter extends EventEmitter {
  private static instance: IdeationEventEmitter;

  private constructor() {
    super();
    // Allow many listeners for SSE connections
    this.setMaxListeners(100);
  }

  static getInstance(): IdeationEventEmitter {
    if (!IdeationEventEmitter.instance) {
      IdeationEventEmitter.instance = new IdeationEventEmitter();
    }
    return IdeationEventEmitter.instance;
  }

  emitSessionEvent(type: SessionEventType, session: Session): void {
    const event: SessionEvent = {
      type,
      session_id: session.id,
      data: session,
      timestamp: new Date().toISOString(),
    };
    const listenerCount = this.listenerCount('session');
    console.log(`[ideation-events] Emitting ${type} for session ${session.id}, listener count: ${listenerCount}`);
    this.emit('session', event);
    this.emit(type, event);
  }
}

export const ideationEvents = IdeationEventEmitter.getInstance();
