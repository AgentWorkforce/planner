/**
 * Relay Client Integration for Ideation Package
 *
 * Provides relay messaging capabilities for the Interviewer service.
 * When running standalone, operates in mock mode.
 * When integrated with planner, can use shared relay connection.
 */

/**
 * Connection state type.
 */
export type ClientState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Message handler type for ideation relay integration.
 */
export type IdeationMessageHandler = (
  from: string,
  body: string,
  threadId?: string,
  data?: Record<string, unknown>
) => Promise<void> | void;

// Internal state
let connectionState: ClientState = 'disconnected';
const messageHandlers: Set<IdeationMessageHandler> = new Set();
const stateChangeHandlers: Set<(state: ClientState) => void> = new Set();

/**
 * Register a handler for incoming relay messages.
 * Returns unsubscribe function.
 */
export function onMessage(handler: IdeationMessageHandler): () => void {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

/**
 * Send a message to a relay channel.
 * Returns true if message was sent, false if not connected.
 */
export function sendChannelMessage(
  channel: string,
  body: string,
  _data?: Record<string, unknown>
): boolean {
  if (connectionState !== 'connected') {
    console.log(`[ideation-relay] Mock send to ${channel}: ${body.substring(0, 50)}...`);
    return false;
  }
  // In integrated mode, this would use the shared relay connection
  console.log(`[ideation-relay] Send to ${channel}: ${body.substring(0, 50)}...`);
  return true;
}

/**
 * Check if relay is connected.
 */
export function isConnected(): boolean {
  return connectionState === 'connected';
}

/**
 * Get current relay connection state.
 */
export function getConnectionState(): ClientState {
  return connectionState;
}

/**
 * Subscribe to relay connection state changes.
 */
export function onStateChange(callback: (state: ClientState) => void): () => void {
  stateChangeHandlers.add(callback);
  return () => {
    stateChangeHandlers.delete(callback);
  };
}

/**
 * Get relay mode for the Interviewer.
 * Returns 'connected' if relay is available, 'mock' otherwise.
 */
export function getRelayMode(): 'connected' | 'mock' {
  return isConnected() ? 'connected' : 'mock';
}

/**
 * Set connection state (for testing or integration).
 */
export function setConnectionState(state: ClientState): void {
  connectionState = state;
  stateChangeHandlers.forEach((handler) => handler(state));
}

/**
 * Dispatch a message to all handlers (for testing or integration).
 */
export function dispatchMessage(
  from: string,
  body: string,
  threadId?: string,
  data?: Record<string, unknown>
): void {
  messageHandlers.forEach((handler) => {
    try {
      void handler(from, body, threadId, data);
    } catch (error) {
      console.error('[ideation-relay] Error in message handler:', error);
    }
  });
}
