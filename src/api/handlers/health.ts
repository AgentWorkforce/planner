/**
 * Health Check Handlers
 *
 * Endpoints for checking service health including relay connection status.
 */

import type { Request, Response } from 'express';
import { getRelayMode } from '../../relay/service.js';
import { getRelayConfig } from '../../relay/config.js';

export interface RelayHealthResponse {
  status: 'connected' | 'disconnected' | 'error';
  socketPath: string;
  message?: string;
}

/**
 * Create health check handlers.
 */
export function createHealthHandlers() {
  return {
    /**
     * GET /api/health/relay
     * Check relay daemon connection status.
     */
    relayHealth: async (_req: Request, res: Response): Promise<void> => {
      try {
        const mode = getRelayMode();
        const config = getRelayConfig();

        const response: RelayHealthResponse = {
          status: mode === 'connected' ? 'connected' : 'disconnected',
          socketPath: config.socketPath,
        };

        if (mode === 'mock') {
          response.message = 'Running in mock mode';
        } else if (mode === 'disconnected') {
          response.message = 'Relay daemon not available';
        }

        res.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const config = getRelayConfig();

        const response: RelayHealthResponse = {
          status: 'error',
          socketPath: config.socketPath,
          message,
        };

        res.status(500).json(response);
      }
    },
  };
}
