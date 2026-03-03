/**
 * Channel REST Handlers
 *
 * Provides relay-aware REST endpoints for channel operations:
 * - GET /api/channels - List available channels
 * - GET /api/channels/:id/messages - Get message history
 * - GET /api/channels/:id/presence - Get online members
 *
 * These handlers check relay connection status and return real data
 * when connected, or empty data when relay is unavailable.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getRelayMode,
  getChannelsForUser,
  getRelay,
  type ChannelInfo,
} from '../../relay/index.js';

interface ChannelParams {
  id: string;
}

/** Channel response format */
interface ChannelResponse {
  id: string;
  name: string;
  type: 'global' | 'plan';
  planId?: string;
  description?: string;
  unreadCount?: number;
  lastMessage?: {
    from: string;
    content: string;
    timestamp: number;
  };
}

/** Presence member format */
interface PresenceMember {
  id: string;
  name: string;
  entityType: 'agent' | 'user';
  status: 'online' | 'idle' | 'offline';
}

/** Storage interface subset needed for channel handlers */
interface ChannelStorage {
  listPlans(): Array<{ plan_id: string }>;
}

/**
 * Create relay-aware channel REST handlers.
 */
export function createChannelHandlers(storage: ChannelStorage) {
  return {
    /**
     * GET /api/channels
     * List available channels for the current user.
     */
    list: async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const mode = getRelayMode();

        // When disconnected, return empty channel list
        if (mode !== 'connected') {
          res.json({ channels: [], mode });
          return;
        }

        // Get all plans the user might have access to
        const plans = storage.listPlans();
        const planIds = plans.map((p) => p.plan_id);

        // Get channels for user
        const channelInfos = getChannelsForUser(planIds);

        // Transform to response format
        const channels: ChannelResponse[] = channelInfos.map((ch: ChannelInfo) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          planId: ch.planId,
          description: ch.description,
          unreadCount: 0,
        }));

        res.json({ channels, mode });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/channels/:id/messages
     * Get message history for a channel.
     */
    messages: async (_req: Request<ChannelParams>, res: Response, next: NextFunction) => {
      try {
        const mode = getRelayMode();

        // 3.x SDK does not expose message history queries.
        // Message history is delivered in real-time via WebSocket; REST endpoint returns empty.
        res.json({ messages: [], hasMore: false, mode });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/channels/:id/presence
     * Get online members in a channel.
     */
    presence: async (req: Request<ChannelParams>, res: Response, next: NextFunction) => {
      try {
        const { id: channelId } = req.params;

        const mode = getRelayMode();

        // When disconnected, return empty
        if (mode !== 'connected') {
          res.json({ members: [], onlineCount: 0, mode });
          return;
        }

        // Query connected agents from relay
        const relay = getRelay();
        if (!relay) {
          res.json({ members: [], onlineCount: 0, mode: 'disconnected' });
          return;
        }

        try {
          // Get list of connected agents
          const agents = await relay.listAgents();

          // Transform to presence format
          const members: PresenceMember[] = agents.map((agent) => ({
            id: agent.name,
            name: agent.name,
            entityType: 'agent' as const,
            status: 'online' as const,
          }));

          res.json({
            members,
            onlineCount: members.length,
            mode,
          });
        } catch (error) {
          console.error(`[channels] Failed to query presence for ${channelId}:`, error);
          res.status(502).json({ members: [], onlineCount: 0, mode, error: 'Failed to fetch presence from relay' });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}
