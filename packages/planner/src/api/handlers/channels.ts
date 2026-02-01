/**
 * Channel REST Handlers
 *
 * Stub implementation for planner package.
 * The actual channel functionality requires the server package with relay.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';

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
    body: string;
    timestamp: number;
  };
}

/** Message response format */
interface MessageResponse {
  id: string;
  from: string;
  content: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/** Presence member format */
interface PresenceMember {
  id: string;
  name: string;
  entityType: 'agent' | 'user';
  status: 'online' | 'idle' | 'offline';
}

/**
 * Create channel REST handlers.
 * Stub implementation - returns demo/empty data (relay not available).
 */
export function createChannelHandlers(_storage: PlanStorage) {
  return {
    /**
     * GET /api/channels
     * Returns demo channel when relay is not available.
     */
    list: async (_req: Request, res: Response, _next: NextFunction) => {
      const demoChannels: ChannelResponse[] = [
        {
          id: '#demo',
          name: 'demo',
          type: 'global',
          description: 'Demo channel (relay unavailable)',
          unreadCount: 0,
        },
      ];
      res.json({ channels: demoChannels, mode: 'standalone' });
    },

    /**
     * GET /api/channels/:id/messages
     * Returns demo messages when relay is not available.
     */
    messages: async (_req: Request<ChannelParams>, res: Response, _next: NextFunction) => {
      const demoMessages: MessageResponse[] = [
        {
          id: 'demo-1',
          from: 'System',
          content: 'This is the standalone planner. Relay features are not available.',
          timestamp: Date.now() - 60000,
        },
      ];
      res.json({
        messages: demoMessages,
        hasMore: false,
        mode: 'standalone',
      });
    },

    /**
     * GET /api/channels/:id/presence
     * Returns empty presence when relay is not available.
     */
    presence: async (_req: Request<ChannelParams>, res: Response, _next: NextFunction) => {
      res.json({
        members: [] as PresenceMember[],
        onlineCount: 0,
        mode: 'standalone',
      });
    },
  };
}
