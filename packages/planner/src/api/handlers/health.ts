/**
 * Health Check Handlers
 *
 * Stub implementation for planner package.
 * The actual relay health requires the server package.
 */

import type { Request, Response } from 'express';

export interface RelayHealthResponse {
  status: 'connected' | 'disconnected' | 'error' | 'standalone';
  socketPath: string;
  message?: string;
}

/**
 * Create health check handlers.
 * Stub implementation - reports standalone mode.
 */
export function createHealthHandlers() {
  return {
    /**
     * GET /api/health/relay
     * Reports standalone mode when relay is not available.
     */
    relayHealth: async (_req: Request, res: Response): Promise<void> => {
      const response: RelayHealthResponse = {
        status: 'standalone',
        socketPath: 'N/A',
        message: 'Running in standalone planner mode (no relay)',
      };
      res.json(response);
    },
  };
}
