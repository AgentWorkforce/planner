/**
 * Channel REST Handlers
 *
 * Provides REST endpoints for channel operations:
 * - GET /api/channels - List available channels
 * - GET /api/channels/:id/messages - Get message history
 * - GET /api/channels/:id/presence - Get online members
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { getChannelsForUser, type ChannelInfo, PLANNER_CHANNEL, getPlanChannelId } from '../../relay/channels.js';
import { getRelayMode, isRelayAvailable } from '../../relay/service.js';
import { getClient } from '../../relay/client.js';

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
 */
export function createChannelHandlers(storage: PlanStorage) {
  return {
    /**
     * GET /api/channels
     * List available channels for the current user.
     */
    list: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const mode = getRelayMode();

        // In mock/demo mode, return demo channel
        if (mode !== 'connected') {
          const demoChannels: ChannelResponse[] = [
            {
              id: '#demo',
              name: 'demo',
              type: 'global',
              description: 'Demo channel (relay unavailable)',
              unreadCount: 0,
            },
          ];
          res.json({ channels: demoChannels, mode });
          return;
        }

        // Get all plans the user might have access to
        const plans = storage.listPlans();
        const planIds = plans.map((p) => p.plan_id);

        // Get channels for user
        const channelInfos = getChannelsForUser(planIds);

        // Transform to response format
        const channels: ChannelResponse[] = channelInfos.map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          planId: ch.planId,
          description: ch.description,
          unreadCount: 0, // TODO: Track unread counts
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
    messages: async (req: Request<ChannelParams>, res: Response, next: NextFunction) => {
      try {
        const { id: channelId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const before = req.query.before as string | undefined;

        const mode = getRelayMode();

        // In mock mode, return demo messages
        if (mode !== 'connected') {
          const demoMessages: MessageResponse[] = [
            {
              id: 'demo-1',
              from: 'Demo AI',
              content: 'Welcome to demo mode! The relay daemon is not connected.',
              timestamp: Date.now() - 60000,
            },
            {
              id: 'demo-2',
              from: 'Demo AI',
              content: 'In demo mode, you can explore the UI but messages are simulated.',
              timestamp: Date.now() - 30000,
            },
          ];
          res.json({
            messages: demoMessages,
            hasMore: false,
            mode,
          });
          return;
        }

        // Query messages from relay
        const client = getClient();
        if (!client) {
          res.json({ messages: [], hasMore: false, mode: 'disconnected' });
          return;
        }

        try {
          // Use channel filter to get channel messages
          const relayMessages = await client.queryMessages({
            limit,
            // Note: The relay queryMessages doesn't have a native channel filter,
            // so we filter client-side for now
          });

          // Filter to channel messages and transform
          // Channel messages have 'to' field starting with #
          const channelMessages = relayMessages
            .filter((msg) => msg.to === channelId)
            .map((msg) => ({
              id: msg.id,
              from: msg.from,
              content: msg.body || '',
              timestamp: msg.timestamp,
              data: msg.data,
            }));

          res.json({
            messages: channelMessages,
            hasMore: channelMessages.length >= limit,
            mode,
          });
        } catch (error) {
          console.error(`[channels] Failed to query messages for ${channelId}:`, error);
          res.json({ messages: [], hasMore: false, mode, error: 'Failed to fetch messages' });
        }
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

        // In mock mode, return demo presence
        if (mode !== 'connected') {
          const demoPresence: PresenceMember[] = [
            {
              id: 'demo-ai',
              name: 'Demo AI',
              entityType: 'agent',
              status: 'online',
            },
          ];
          res.json({
            members: demoPresence,
            onlineCount: 1,
            mode,
          });
          return;
        }

        // Query connected agents from relay
        const client = getClient();
        if (!client) {
          res.json({ members: [], onlineCount: 0, mode: 'disconnected' });
          return;
        }

        try {
          // Get list of connected agents
          const agents = await client.listConnectedAgents();

          // Transform to presence format
          // Note: We don't have channel membership info from relay directly,
          // so we return all connected agents for now
          const members: PresenceMember[] = agents.map((agent) => ({
            id: agent.name,
            name: agent.name,
            // AgentInfo doesn't expose entityType, default to 'agent'
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
          res.json({ members: [], onlineCount: 0, mode, error: 'Failed to fetch presence' });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}
