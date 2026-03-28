/**
 * Ideation API - Event Emitter
 *
 * Pub/sub for session changes to support SSE.
 */

import { EventEmitter } from 'node:events';
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
  | 'session:planner_send'
  | 'session:block_created'
  | 'session:block_updated'
  | 'session:block_deleted'
  | 'session:block_curated'
  | 'session:blocks_graduated'
  | 'session:synthesis_updated';

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
    // Use any cast to escape type augmentation from tuner's typed emitter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).emit('session', event);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).emit(type, event);
  }
}

export const ideationEvents = IdeationEventEmitter.getInstance();
