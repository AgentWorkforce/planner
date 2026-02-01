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
import { getChannelsForUser, type ChannelInfo, PLANNER_CHANNEL, getPlanChannelId, createDmChannel } from '../../relay/channels.js';
import { getRelayMode, isRelayAvailable } from '../../relay/service.js';
import { getClient } from '../../relay/client.js';

interface ChannelParams {
  id: string;
}

/** Channel response format */
interface ChannelResponse {
  id: string;
  name: string;
  type: 'global' | 'plan' | 'dm';
  planId?: string;
  agentId?: string; // For DM channels - target agent ID
  agentName?: string; // For DM channels - display name
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
     * Query params:
     *  - userId: Optional. If provided, includes DM channels for this user.
     *  - activeOnly: Optional. If true, only return #planner, active plan channels, and DMs.
     *  - planId: Optional. If provided, always include this plan's channel (even with activeOnly).
     */
    list: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const mode = getRelayMode();
        const userId = req.query.userId as string | undefined;
        const activeOnly = req.query.activeOnly === 'true';
        const specificPlanId = req.query.planId as string | undefined;

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

        // Build a plan lookup map for titles
        const plans = storage.listPlans();
        const planLookup = new Map<string, { title: string; goal?: string }>();
        for (const plan of plans) {
          // Try to get plan's latest version for goal/title
          try {
            const latestVersion = storage.getLatestVersion(plan.plan_id);
            const goal = latestVersion?.summary?.goal;
            planLookup.set(plan.plan_id, {
              title: goal?.slice(0, 40) || `Plan ${plan.plan_id.slice(0, 8)}`,
              goal,
            });
          } catch {
            planLookup.set(plan.plan_id, { title: `Plan ${plan.plan_id.slice(0, 8)}` });
          }
        }

        // Get channels for user (including DM channels if userId is provided)
        // Only pass plan IDs for active channels, not all plans
        const planIds = activeOnly ? undefined : plans.map((p) => p.plan_id);
        const channelInfos = getChannelsForUser(planIds, userId);

        // If a specific planId is requested, ensure its channel is included
        if (specificPlanId) {
          const planChannelId = getPlanChannelId(specificPlanId);
          const alreadyIncluded = channelInfos.some(ch => ch.planId === specificPlanId);
          if (!alreadyIncluded) {
            channelInfos.push({
              id: planChannelId,
              name: planChannelId.slice(1), // Remove # prefix
              type: 'plan',
              planId: specificPlanId,
            });
          }
        }

        // Transform to response format with plan titles
        const channels: ChannelResponse[] = channelInfos.map((ch) => {
          let displayName = ch.name;

          // For plan channels, use the plan goal/title instead of hash
          if (ch.type === 'plan' && ch.planId) {
            const planInfo = planLookup.get(ch.planId);
            displayName = planInfo?.title || ch.name;
          }

          // For DM channels, use agent name
          if (ch.type === 'dm' && ch.agentName) {
            displayName = ch.agentName;
          }

          return {
            id: ch.id,
            name: displayName,
            type: ch.type,
            planId: ch.planId,
            agentId: ch.agentId,
            agentName: ch.agentName,
            description: ch.description,
            unreadCount: 0, // TODO: Track unread counts
          };
        });

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
          // Use getInbox with channel filter to get channel messages
          // getInbox returns messages received by planner-core in the channel
          const inboxMessages = await client.getInbox({
            limit,
            channel: channelId,
          });

          // Debug: log what we got from relay
          console.log(`[channels] getInbox returned ${inboxMessages.length} messages for ${channelId}`);
          if (inboxMessages.length > 0) {
            console.log(`[channels] Sample message:`, JSON.stringify(inboxMessages[0], null, 2));
          }

          // Transform inbox messages to response format
          const channelMessages = inboxMessages.map((msg) => ({
            id: msg.id,
            from: msg.from,
            fromName: msg.from, // Use from as display name
            entityType: (msg.from.startsWith('user-') ? 'user' : 'agent') as 'user' | 'agent',
            channel: channelId,
            body: msg.body || '',
            timestamp: typeof msg.timestamp === 'number'
              ? new Date(msg.timestamp).toISOString()
              : String(msg.timestamp),
          }));

          // Sort by timestamp ascending (oldest first) for chronological chat display
          channelMessages.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

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

    /**
     * POST /api/channels/dm
     * Create or return existing DM channel.
     * Body: { agentId: string, agentName: string }
     * Query/Header: userId
     */
    createDm: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { agentId, agentName } = req.body;
        const userId = (req.query.userId as string) || req.get('X-User-Id');

        // Validate required fields
        if (!agentId || !agentName) {
          res.status(400).json({ error: 'agentId and agentName required' });
          return;
        }

        if (!userId) {
          res.status(400).json({ error: 'userId required (query param or X-User-Id header)' });
          return;
        }

        const mode = getRelayMode();

        // In mock mode, return mock DM channel
        if (mode !== 'connected') {
          const mockChannel: ChannelResponse = {
            id: `#dm-${userId}-${agentId}`,
            name: agentName,
            type: 'dm',
            agentId,
            agentName,
            unreadCount: 0,
          };
          res.json({ channel: mockChannel, mode });
          return;
        }

        // Create or get existing DM channel
        const channelInfo = createDmChannel(userId, agentId, agentName);

        if (!channelInfo) {
          res.status(503).json({ error: 'Failed to create DM channel (relay not available)' });
          return;
        }

        // Transform to response format
        const channel: ChannelResponse = {
          id: channelInfo.id,
          name: channelInfo.agentName || channelInfo.name,
          type: 'dm',
          agentId: channelInfo.agentId,
          agentName: channelInfo.agentName,
          unreadCount: 0,
        };

        res.json({ channel, mode });
      } catch (err) {
        next(err);
      }
    },
  };
}
