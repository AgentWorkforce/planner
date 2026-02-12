/**
 * Health Check Handlers
 *
 * Provides relay-aware health endpoints:
 * - GET /api/health/relay - Check relay daemon connection status
 */

import type { Request, Response } from 'express';
import { getRelayMode, getRelayConfig } from '../../relay/index.js';
import { getConnectionMetrics, getConnectionState } from '../../relay/client.js';

export interface RelayHealthResponse {
  status: 'connected' | 'disconnected' | 'error';
  socketPath: string;
  message?: string;
  metrics?: {
    state: string;
    connectCount: number;
    disconnectCount: number;
    lastConnectedAt: number | null;
    lastDisconnectedAt: number | null;
    lastError: string | null;
    currentStateDurationMs: number;
  };
}

/**
 * Create relay-aware health check handlers.
 */
export function createHealthHandlers() {
  return {
    /**
     * GET /api/health/relay
     * Reports actual relay connection status.
     */
    relayHealth: async (_req: Request, res: Response): Promise<void> => {
      const mode = getRelayMode();
      const config = getRelayConfig();

      let status: RelayHealthResponse['status'];
      let message: string;

      if (mode === 'connected') {
        status = 'connected';
        message = 'Relay daemon connected and ready';
      } else {
        status = 'disconnected';
        message = 'Relay daemon not connected';
      }

      const connectionMetrics = getConnectionMetrics();
      const response: RelayHealthResponse = {
        status,
        socketPath: config.socketPath,
        message,
        metrics: {
          state: getConnectionState(),
          connectCount: connectionMetrics.connectCount,
          disconnectCount: connectionMetrics.disconnectCount,
          lastConnectedAt: connectionMetrics.lastConnectedAt,
          lastDisconnectedAt: connectionMetrics.lastDisconnectedAt,
          lastError: connectionMetrics.lastError,
          currentStateDurationMs: connectionMetrics.currentStateDurationMs,
        },
      };
      res.json(response);
    },
  };
}
