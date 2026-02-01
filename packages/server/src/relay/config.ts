/**
 * Relay Configuration Module
 *
 * Provides configuration for connecting to the relay-daemon.
 */

export interface RelayConfig {
  /** Unix socket path for daemon connection */
  socketPath: string;
  /** Interval between reconnection attempts in ms */
  reconnectInterval: number;
  /** Maximum reconnection attempts (0 = unlimited) */
  maxReconnectAttempts: number;
  /** Maximum delay between reconnection attempts in ms */
  maxReconnectDelay: number;
  /** MCP server URL for agent tool access */
  mcpServerUrl: string;
}

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Use project-local socket path (matches relay-daemon default behavior)
const DEFAULT_SOCKET_PATH = path.join(PROJECT_ROOT, '.agent-relay', 'relay.sock');
const DEFAULT_RECONNECT_INTERVAL = 5000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 0; // unlimited
const DEFAULT_MAX_RECONNECT_DELAY = 30000;
const DEFAULT_MCP_SERVER_URL = 'http://localhost:3001/api/mcp';

/**
 * Get relay configuration from environment variables with sensible defaults.
 */
export function getRelayConfig(): RelayConfig {
  const port = process.env.PORT || '3001';
  const host = process.env.MCP_SERVER_HOST || `http://localhost:${port}`;

  return {
    socketPath: process.env.RELAY_SOCKET_PATH || DEFAULT_SOCKET_PATH,
    reconnectInterval: parseInt(process.env.RELAY_RECONNECT_INTERVAL || '', 10) || DEFAULT_RECONNECT_INTERVAL,
    maxReconnectAttempts: parseInt(process.env.RELAY_MAX_RECONNECT_ATTEMPTS || '', 10) || DEFAULT_MAX_RECONNECT_ATTEMPTS,
    maxReconnectDelay: parseInt(process.env.RELAY_MAX_RECONNECT_DELAY || '', 10) || DEFAULT_MAX_RECONNECT_DELAY,
    mcpServerUrl: process.env.MCP_SERVER_URL || `${host}/api/mcp`,
  };
}
