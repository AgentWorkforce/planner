/**
 * Health Check Handlers
 *
 * Provides relay-aware health endpoints:
 * - GET /api/health/relay - Check relay daemon connection status
 */

import type { Request, Response } from 'express';
import { getRelayMode, getRelayConfig } from '../../relay/index.js';

export interface RelayHealthResponse {
  status: 'connected' | 'disconnected' | 'error' | 'standalone';
  socketPath: string;
  message?: string;
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

      switch (mode) {
        case 'connected':
          status = 'connected';
          message = 'Relay daemon connected and ready';
          break;
        case 'mock':
          status = 'standalone';
          message = 'Running in mock mode (relay bypassed)';
          break;
        default:
          status = 'disconnected';
          message = 'Relay daemon not connected';
      }

      const response: RelayHealthResponse = {
        status,
        socketPath: config.socketPath,
        message,
      };
      res.json(response);
    },
  };
}
