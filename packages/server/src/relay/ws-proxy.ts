/**
 * WebSocket Proxy for Relay Communication
 *
 * Bridges browser WebSocket connections to the single shared relay client.
 * The server acts as a message router: one AgentRelay instance, many browsers.
 * Channel membership is tracked locally per UserConnection — no per-browser relay clients.
 *
 * Protocol:
 * - Browser sends JSON: { type: 'join'|'leave'|'send'|'dm', ... }
 * - Browser receives JSON: { type: 'message'|'channel_message'|'presence'|'status'|'error'|'joined'|'left', ... }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { sendMessage, sendChannelMessage, onMessage, onStateChange, isConnected, type ConnectionState } from './client.js';
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
  status?: ConnectionState;
  error?: string;
}

/** Active connection tracking — no relay client, just channel membership */
interface UserConnection {
  ws: WebSocket;
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
async function handleBrowserMessage(conn: UserConnection, message: BrowserMessage): Promise<void> {
  const { ws } = conn;

  switch (message.type) {
    case 'join':
      if (message.channel) {
        conn.channels.add(message.channel);
        sendToBrowser(ws, { type: 'joined', channel: message.channel });
        onUserChannelJoinCallback?.(message.channel);
        addWatcher(message.channel, conn.userId);
      }
      break;

    case 'leave':
      if (message.channel) {
        conn.channels.delete(message.channel);
        sendToBrowser(ws, { type: 'left', channel: message.channel });
        removeWatcher(message.channel, conn.userId);
      }
      break;

    case 'send':
      if (message.channel && message.body) {
        // Auto-track channel if not already tracked
        if (!conn.channels.has(message.channel)) {
          conn.channels.add(message.channel);
          sendToBrowser(ws, { type: 'joined', channel: message.channel });
        }
        try {
          await sendChannelMessage(message.channel, message.body, message.data);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          sendToBrowser(ws, { type: 'error', error: `Failed to send message: ${msg}` });
        }
      }
      break;

    case 'dm':
      if (message.to && message.body) {
        try {
          await sendMessage(message.to, message.body, undefined, message.data);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          sendToBrowser(ws, { type: 'error', error: `Failed to send direct message: ${msg}` });
        }
      }
      break;

    default:
      sendToBrowser(ws, { type: 'error', error: `Unknown message type: ${(message as BrowserMessage).type}` });
  }
}

/**
 * Generate a unique user ID for a browser connection.
 */
function generateUserId(): string {
  return `user-${randomUUID().slice(0, 8)}`;
}

/**
 * Initialize WebSocket proxy server.
 *
 * Registers a single global relay message handler that routes incoming relay
 * messages to all subscribed browser connections. The relay is always available
 * (embedded broker), so connections are never rejected based on relay mode.
 */
export function initWebSocketProxy(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/relay',
  });

  console.log('[ws-proxy] WebSocket proxy initialized at /ws/relay');

  // Register direct-to-browser broadcast for agent status events
  setBrowserBroadcast((message) => {
    broadcastToUsers(message as unknown as RelayMessage);
  });

  // Forward relay connection state changes to all browsers
  onStateChange((state) => {
    for (const conn of connections.values()) {
      sendToBrowser(conn.ws, { type: 'status', status: state });
    }
  });

  // Route incoming relay messages to subscribed browsers
  onMessage((from, to, body, _threadId, data) => {
    const isChannelMessage = to.startsWith('#');

    for (const conn of connections.values()) {
      if (isChannelMessage) {
        // Channel message — only deliver to browsers subscribed to this channel
        if (conn.channels.has(to)) {
          const isUserMessage = from.startsWith('user-') || from.startsWith('anon-');
          sendToBrowser(conn.ws, {
            type: 'channel_message',
            channel: to,
            from,
            fromName: from,
            entityType: isUserMessage ? 'user' : 'agent',
            body,
            timestamp: Date.now(),
            data,
          });
        }
      } else {
        // Direct message — deliver only to the target user if connected
        if (conn.userId === to || conn.displayName === to) {
          const isUserMessage = from.startsWith('user-') || from.startsWith('anon-');
          sendToBrowser(conn.ws, {
            type: 'message',
            from,
            fromName: from,
            entityType: isUserMessage ? 'user' : 'agent',
            body,
            timestamp: Date.now(),
            data,
          });
        }
      }
    }
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const displayName = url.searchParams.get('name') || 'Anonymous';
    const userId = url.searchParams.get('userId') || generateUserId();

    const conn: UserConnection = {
      ws,
      userId,
      displayName,
      channels: new Set(),
    };
    connections.set(ws, conn);

    // Send initial relay connection status
    sendToBrowser(ws, { type: 'status', status: isConnected() ? 'connected' : 'disconnected' });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as BrowserMessage;
        handleBrowserMessage(conn, message).catch((error) => {
          const msg = error instanceof Error ? error.message : String(error);
          sendToBrowser(ws, { type: 'error', error: `Message handling error: ${msg}` });
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendToBrowser(ws, { type: 'error', error: `Invalid message format: ${msg}` });
      }
    });

    ws.on('close', () => {
      for (const channel of conn.channels) {
        removeWatcher(channel, conn.userId);
      }
      connections.delete(ws);
      console.log(`[ws-proxy] User ${displayName} (${userId}) disconnected`);
    });

    ws.on('error', (error) => {
      console.error(`[ws-proxy] WebSocket error for ${userId}:`, error.message);
    });

    console.log(`[ws-proxy] User ${displayName} (${userId}) connected`);
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
