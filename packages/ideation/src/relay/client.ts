/**
 * Relay Client Integration for Ideation Package
 *
 * Provides relay messaging capabilities for the Interviewer service.
 * When integrated with planner server, uses shared relay connection via injected sender.
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

// Optional injected sender for integration with server relay
type ChannelSender = (channel: string, body: string, data?: Record<string, unknown>) => boolean;
let injectedSender: ChannelSender | null = null;

/**
 * Register a handler for incoming relay messages.
 * Returns unsubscribe function.
 */
export function onMessage(handler: IdeationMessageHandler): () => void {
  messageHandlers.add(handler);
  console.log(`[ideation-relay] Handler registered, total handlers: ${messageHandlers.size}`);
  return () => {
    messageHandlers.delete(handler);
    console.log(`[ideation-relay] Handler unregistered, total handlers: ${messageHandlers.size}`);
  };
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
  console.log(`[ideation-relay] sendChannelMessage: channel=${channel}, state=${connectionState}, hasSender=${!!injectedSender}`);

  if (connectionState !== 'connected') {
    console.log(`[ideation-relay] Not connected — message to ${channel} will not be delivered`);
    return false;
  }

  // Use injected sender if available (integrated mode)
  if (injectedSender) {
    console.log(`[ideation-relay] Using injected sender for ${channel}`);
    const result = injectedSender(channel, body, data);
    console.log(`[ideation-relay] Injected sender result: ${result}`);
    return result;
  }

  // Standalone mode - warn if connected but no sender (injection timing issue)
  console.warn(
    `[ideation-relay] Connected but no sender injected - message to ${channel} will not be delivered. ` +
    `Call setSender() to enable message sending.`
  );
  return false;
}

/**
 * Inject a sender function for integrated mode.
 * Called by server to route sends through its relay client.
 */
export function setSender(sender: ChannelSender | null): void {
  console.log(`[ideation-relay] setSender called: sender=${sender ? 'function' : 'null'}`);
  injectedSender = sender;
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
 * Set connection state (for testing or integration).
 */
export function setConnectionState(state: ClientState): void {
  console.log(`[ideation-relay] setConnectionState: ${connectionState} -> ${state}`);
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
  console.log(`[ideation-relay] dispatchMessage: from=${from}, handlers=${messageHandlers.size}, body="${body.substring(0, 50)}..."`);
  messageHandlers.forEach((handler) => {
    try {
      console.log(`[ideation-relay] Calling handler...`);
      void handler(from, body, threadId, data);
    } catch (error) {
      console.error('[ideation-relay] Error in message handler:', error);
    }
  });
}
