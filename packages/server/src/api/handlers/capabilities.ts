/**
 * Capabilities Handler
 *
 * Provides system capabilities and feature flags endpoint:
 * - GET /api/capabilities - Returns current system capabilities
 */

import type { Request, Response } from 'express';
import { getRelayMode, getRelayConfig, isConnected } from '../../relay/index.js';

export interface CapabilitiesResponse {
  relay: {
    available: boolean;
    url: string;
    status: 'connected' | 'disconnected';
  };
  forge: {
    available: boolean;
  };
  features: {
    planning: boolean;
    ideation: boolean;
    orchestration: boolean;
  };
}

/**
 * Create capabilities handlers.
 */
export function createCapabilitiesHandlers() {
  return {
    /**
     * GET /api/capabilities
     * Returns current system capabilities and feature flags.
     */
    list: async (_req: Request, res: Response): Promise<void> => {
      const relayMode = getRelayMode();
      const relayConfig = getRelayConfig();
      const relayConnected = isConnected();

      const response: CapabilitiesResponse = {
        relay: {
          available: relayConnected,
          url: relayConfig.mcpServerUrl,
          status: relayMode,
        },
        forge: {
          available: relayConnected, // Forge requires relay for real agent spawning
        },
        features: {
          planning: true, // Always available
          ideation: true, // Always available
          orchestration: relayConnected, // Requires relay for real execution
        },
      };

      res.json(response);
    },
  };
}
