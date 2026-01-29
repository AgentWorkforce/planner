/**
 * Relay Client Wrapper
 *
 * Wraps @agent-relay/sdk client with connection management.
 * Handles errors gracefully - catches and logs, doesn't throw.
 */

import { RelayClient, type ClientState, type SendPayload, type SendMeta } from '@agent-relay/sdk';
import { getRelayConfig, type RelayConfig } from './config.js';

let client: RelayClient | null = null;
let connectionState: ClientState = 'DISCONNECTED';
let config: RelayConfig | null = null;

const stateChangeListeners: Set<(state: ClientState) => void> = new Set();

/** Message handler type */
type MessageHandler = (from: string, body: string, threadId?: string, data?: Record<string, unknown>) => void;

/** Registered message handlers */
const messageHandlers: Set<MessageHandler> = new Set();

/**
 * Register a handler for incoming messages.
 * Returns unsubscribe function.
 */
export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

/**
 * Internal: route incoming message to all registered handlers.
 */
function routeMessage(from: string, payload: SendPayload, messageId: string, meta?: SendMeta): void {
  const body = payload.body || '';
  const threadId = payload.thread;
  const data = payload.data;

  console.log(`[relay] Received message from ${from}${threadId ? ` (thread: ${threadId})` : ''}`);

  for (const handler of messageHandlers) {
    try {
      handler(from, body, threadId, data);
    } catch (error) {
      console.error('[relay] Error in message handler:', error);
    }
  }
}

/**
 * Connect to the relay daemon.
 * Connection errors are caught and logged, not thrown.
 */
export async function connect(): Promise<void> {
  if (client && connectionState === 'READY') {
    return;
  }

  config = getRelayConfig();

  try {
    client = new RelayClient({
      agentName: 'planner-core',
      socketPath: config.socketPath,
      reconnect: true,
      maxReconnectAttempts: config.maxReconnectAttempts,
      reconnectDelayMs: config.reconnectInterval,
      reconnectMaxDelayMs: config.maxReconnectDelay,
      quiet: false,
    });

    client.onStateChange = (newState: ClientState) => {
      const oldState = connectionState;
      connectionState = newState;

      if (oldState !== newState) {
        console.log(`[relay] Connection state: ${oldState} -> ${newState}`);
        notifyStateChange(newState);
      }
    };

    client.onError = (error: Error) => {
      console.error('[relay] Client error:', error.message);
    };

    // Wire up message routing to registered handlers
    client.onMessage = routeMessage;

    await client.connect();
    console.log(`[relay] Connected to daemon at ${config.socketPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Failed to connect to daemon at ${config?.socketPath}: ${message}`);
    connectionState = 'DISCONNECTED';
  }
}

/**
 * Disconnect from the relay daemon.
 */
export function disconnect(): void {
  if (!client) {
    return;
  }

  try {
    client.disconnect();
    console.log('[relay] Disconnected from daemon');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Error during disconnect: ${message}`);
  } finally {
    connectionState = 'DISCONNECTED';
    notifyStateChange('DISCONNECTED');
  }
}

/**
 * Destroy the relay client permanently.
 */
export function destroy(): void {
  if (!client) {
    return;
  }

  try {
    client.destroy();
    console.log('[relay] Client destroyed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[relay] Error during destroy: ${message}`);
  } finally {
    client = null;
    connectionState = 'DISCONNECTED';
    notifyStateChange('DISCONNECTED');
  }
}

/**
 * Check if the client is connected.
 */
export function isConnected(): boolean {
  return connectionState === 'READY';
}

/**
 * Get the current connection state.
 */
export function getConnectionState(): ClientState {
  return connectionState;
}

/**
 * Get the relay client instance.
 * Returns null when not connected.
 */
export function getClient(): RelayClient | null {
  if (connectionState !== 'READY') {
    return null;
  }
  return client;
}

/**
 * Send a message to another agent.
 * Returns true if message was queued, false if not connected.
 */
export function sendMessage(
  to: string,
  body: string,
  kind?: string,
  data?: Record<string, unknown>,
  thread?: string
): boolean {
  if (!client || connectionState !== 'READY') {
    console.error('[relay] Cannot send message: not connected');
    return false;
  }

  return client.sendMessage(to, body, kind as 'message' | 'action' | 'state' | 'thinking', data, thread);
}

/**
 * Subscribe to connection state changes.
 */
export function onStateChange(callback: (state: ClientState) => void): () => void {
  stateChangeListeners.add(callback);
  return () => {
    stateChangeListeners.delete(callback);
  };
}

function notifyStateChange(state: ClientState): void {
  for (const listener of stateChangeListeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('[relay] Error in state change listener:', error);
    }
  }
}

// Re-export types
export type { ClientState };
