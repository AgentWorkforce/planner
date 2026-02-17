/**
 * WebSocket Proxy for Relay Communication
 *
 * Bridges browser WebSocket connections to the relay daemon.
 * Each browser connection gets its own RelayClient with entityType: 'user'.
 *
 * Protocol:
 * - Browser sends JSON: { type: 'join'|'leave'|'send'|'dm', ... }
 * - Browser receives JSON: { type: 'message'|'presence'|'error', ... }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { RelayClient, type ClientState, type SendPayload, type SendMeta, type ChannelMessagePayload, type Envelope } from '@agent-relay/sdk';
import { getRelayConfig } from './config.js';
import { getRelayMode } from './service.js';
import { setBrowserBroadcast } from './agent-status.js';
import { addWatcher, removeWatcher } from './session-presence.js';
import { randomUUID } from 'crypto';

/** Incoming message from browser */
interface BrowserMessage {
  type: 'join' | 'leave' | 'send' | 'dm';
  channel?: string;
  to?: string;
  body?: string;
  data?: Record<string, unknown>;
}

/** Outgoing message to browser */
interface RelayMessage {
  type: 'message' | 'channel_message' | 'presence' | 'status' | 'error' | 'joined' | 'left';
  channel?: string;
  from?: string;
  fromName?: string;
  entityType?: 'user' | 'agent';
  body?: string;
  messageId?: string;
  timestamp?: number;
  data?: Record<string, unknown>;
  status?: ClientState;
  error?: string;
}

/** Active connection tracking */
interface UserConnection {
  ws: WebSocket;
  client: RelayClient;
  userId: string;
  displayName: string;
  channels: Set<string>;
}

const connections = new Map<WebSocket, UserConnection>();

/** Optional callback fired when a user joins a channel */
let onUserChannelJoinCallback: ((channel: string) => void) | null = null;

/**
 * Register a callback for user channel joins.
 * Used by ideation-bridge to spawn agents on-demand when a user navigates to a session.
 */
export function onUserChannelJoin(callback: (channel: string) => void): void {
  onUserChannelJoinCallback = callback;
}

/**
 * Send a message to the browser WebSocket.
 */
function sendToBrowser(ws: WebSocket, message: RelayMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Handle incoming message from browser.
 */
function handleBrowserMessage(conn: UserConnection, message: BrowserMessage): void {
  const { client, ws } = conn;

  switch (message.type) {
    case 'join':
      if (message.channel) {
        const joined = client.joinChannel(message.channel, conn.displayName);
        if (joined) {
          conn.channels.add(message.channel);
          sendToBrowser(ws, { type: 'joined', channel: message.channel });
          onUserChannelJoinCallback?.(message.channel);
          addWatcher(message.channel, conn.userId);
        } else {
          sendToBrowser(ws, { type: 'error', error: `Failed to join channel ${message.channel}` });
        }
      }
      break;

    case 'leave':
      if (message.channel) {
        const left = client.leaveChannel(message.channel);
        if (left) {
          conn.channels.delete(message.channel);
          sendToBrowser(ws, { type: 'left', channel: message.channel });
          removeWatcher(message.channel, conn.userId);
        }
      }
      break;

    case 'send':
      if (message.channel && message.body) {
        // Auto-join channel if not already a member (relay requires membership to send)
        if (!conn.channels.has(message.channel)) {
          console.log(`[ws-proxy] User ${conn.userId} auto-joining ${message.channel} before sending`);
          const joined = client.joinChannel(message.channel, conn.displayName);
          if (joined) {
            conn.channels.add(message.channel);
            sendToBrowser(ws, { type: 'joined', channel: message.channel });
          } else {
            console.log(`[ws-proxy] Failed to auto-join ${message.channel}`);
            sendToBrowser(ws, { type: 'error', error: `Failed to join channel ${message.channel}` });
            break;
          }
        }

        console.log(`[ws-proxy] User ${conn.userId} sending to ${message.channel}: "${message.body.slice(0, 50)}"`);
        console.log(`[ws-proxy] User channels: ${Array.from(conn.channels).join(', ')}`);
        console.log(`[ws-proxy] Client state: ${client.state}`);
        const sent = client.sendChannelMessage(message.channel, message.body, {
          data: message.data,
        });
        if (sent) {
          console.log(`[ws-proxy] Message sent successfully to ${message.channel}`);
        } else {
          console.log(`[ws-proxy] Failed to send message - client not connected`);
          sendToBrowser(ws, { type: 'error', error: 'Failed to send message: not connected' });
        }
      }
      break;

    case 'dm':
      if (message.to && message.body) {
        const sent = client.sendMessage(message.to, message.body, 'message', message.data);
        if (!sent) {
          sendToBrowser(ws, { type: 'error', error: 'Failed to send direct message: not connected' });
        }
      }
      break;

    default:
      sendToBrowser(ws, { type: 'error', error: `Unknown message type: ${(message as BrowserMessage).type}` });
  }
}

/**
 * Create a RelayClient for a browser user connection.
 */
async function createUserClient(ws: WebSocket, userId: string, displayName: string): Promise<UserConnection> {
  const config = getRelayConfig();

  const client = new RelayClient({
    agentName: userId,
    socketPath: config.socketPath,
    entityType: 'user',
    displayName,
    reconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelayMs: 1000,
    reconnectMaxDelayMs: 10000,
    quiet: true,
  });

  const conn: UserConnection = {
    ws,
    client,
    userId,
    displayName,
    channels: new Set(),
  };

  // Wire up relay callbacks to browser
  client.onStateChange = (state: ClientState) => {
    sendToBrowser(ws, { type: 'status', status: state });
  };

  client.onMessage = (from: string, payload: SendPayload, messageId: string, meta?: SendMeta) => {
    // Determine entity type based on sender name pattern
    const isUserMessage = from.startsWith('user-') || from.startsWith('anon-');
    sendToBrowser(ws, {
      type: 'message',
      from,
      fromName: from,
      entityType: isUserMessage ? 'user' : 'agent',
      body: payload.body || '',
      messageId,
      timestamp: Date.now(),
      data: payload.data,
    });
  };

  client.onChannelMessage = (from: string, channel: string, body: string, envelope: Envelope<ChannelMessagePayload>) => {
    console.log(`[ws-proxy] Received channel message from ${from} in ${channel}: "${body.slice(0, 50)}"`);
    // Determine entity type based on sender name pattern
    const isUserMessage = from.startsWith('user-') || from.startsWith('anon-');
    sendToBrowser(ws, {
      type: 'channel_message',
      channel,
      from,
      fromName: from,
      entityType: isUserMessage ? 'user' : 'agent',
      body,
      messageId: envelope.id,
      timestamp: envelope.ts || Date.now(),
      data: envelope.payload?.data,
    });
  };

  client.onError = (error: Error) => {
    sendToBrowser(ws, { type: 'error', error: error.message });
  };

  try {
    await client.connect();
    console.log(`[ws-proxy] User ${displayName} (${userId}) connected to relay`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ws-proxy] Failed to connect user ${userId} to relay: ${message}`);
    sendToBrowser(ws, { type: 'error', error: `Failed to connect to relay: ${message}` });
  }

  return conn;
}

/**
 * Generate a unique user ID for a browser connection.
 */
function generateUserId(): string {
  return `user-${randomUUID().slice(0, 8)}`;
}

/**
 * Initialize WebSocket proxy server.
 */
export function initWebSocketProxy(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/relay',
  });

  console.log('[ws-proxy] WebSocket proxy initialized at /ws/relay');

  // Register direct-to-browser broadcast for agent status events
  // (relay broadcasts may not reach user-type clients)
  setBrowserBroadcast((message) => {
    broadcastToUsers(message as RelayMessage);
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    // Extract user info from query string or headers
    // For now, generate anonymous user IDs - can be extended with auth
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const displayName = url.searchParams.get('name') || 'Anonymous';
    const userId = url.searchParams.get('userId') || generateUserId();

    const mode = getRelayMode();

    if (mode !== 'connected') {
      console.log(`[ws-proxy] User ${displayName} (${userId}) rejected: relay not connected`);
      sendToBrowser(ws, {
        type: 'status',
        status: 'DISCONNECTED' as ClientState,
        data: { message: 'Relay daemon not available. Start the relay daemon to enable real-time messaging.' },
      });
      ws.close(1013, 'Relay daemon not available');
      return;
    }

    // Connected mode - create real relay connection
    try {
      const conn = await createUserClient(ws, userId, displayName);
      connections.set(ws, conn);

      // Send initial status
      sendToBrowser(ws, { type: 'status', status: conn.client.state });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as BrowserMessage;
          handleBrowserMessage(conn, message);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          sendToBrowser(ws, { type: 'error', error: `Invalid message format: ${msg}` });
        }
      });

      ws.on('close', () => {
        console.log(`[ws-proxy] User ${displayName} (${userId}) disconnected`);
        // Remove watchers for all channels this user was in
        for (const channel of conn.channels) {
          removeWatcher(channel, conn.userId);
        }
        conn.client?.destroy();
        connections.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`[ws-proxy] WebSocket error for ${userId}:`, error.message);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ws-proxy] Failed to create user connection: ${message}`);
      sendToBrowser(ws, { type: 'error', error: message });
      ws.close();
    }
  });

  return wss;
}

/**
 * Get all active connections (for admin/monitoring).
 */
export function getActiveConnections(): Array<{ userId: string; displayName: string; channels: string[] }> {
  return Array.from(connections.values()).map((conn) => ({
    userId: conn.userId,
    displayName: conn.displayName,
    channels: Array.from(conn.channels),
  }));
}

/**
 * Broadcast a message to all connected users (for server-initiated events).
 */
export function broadcastToUsers(message: RelayMessage): void {
  for (const conn of connections.values()) {
    sendToBrowser(conn.ws, message);
  }
}
