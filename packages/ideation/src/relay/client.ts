/**
 * Relay Client Integration for Ideation Package
 *
 * Provides relay messaging capabilities for the Interviewer service.
 * Follows the same pattern as planner-core's relay integration.
 */

import {
  onMessage as relayOnMessage,
  sendChannelMessage as relaySendChannelMessage,
  isConnected as relayIsConnected,
  getConnectionState as relayGetConnectionState,
  onStateChange as relayOnStateChange,
  type ClientState,
} from '../../../../src/relay/client.js';

/**
 * Message handler type for ideation relay integration.
 */
export type IdeationMessageHandler = (
  from: string,
  body: string,
  threadId?: string,
  data?: Record<string, unknown>
) => Promise<void> | void;

/**
 * Register a handler for incoming relay messages.
 * Returns unsubscribe function.
 */
export function onMessage(handler: IdeationMessageHandler): () => void {
  return relayOnMessage((from, body, threadId, data) => {
    // Wrap in try-catch to prevent handler errors from propagating
    try {
      void handler(from, body, threadId, data);
    } catch (error) {
      console.error('[ideation-relay] Error in message handler:', error);
    }
  });
}

/**
 * Send a message to a relay channel.
 * Returns true if message was sent, false if not connected.
 */
export function sendChannelMessage(
  channel: string,
  body: string,
  data?: Record<string, unknown>
): boolean {
  return relaySendChannelMessage(channel, body, data);
}

/**
 * Check if relay is connected.
 */
export function isConnected(): boolean {
  return relayIsConnected();
}

/**
 * Get current relay connection state.
 */
export function getConnectionState(): ClientState {
  return relayGetConnectionState();
}

/**
 * Subscribe to relay connection state changes.
 */
export function onStateChange(callback: (state: ClientState) => void): () => void {
  return relayOnStateChange(callback);
}

/**
 * Get relay mode for the Interviewer.
 * Returns 'connected' if relay is available, 'mock' otherwise.
 */
export function getRelayMode(): 'connected' | 'mock' {
  return isConnected() ? 'connected' : 'mock';
}
