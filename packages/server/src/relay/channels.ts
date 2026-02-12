/**
 * Channel Management Module
 *
 * Manages relay channels for planner communication:
 * - #planner: Global planning channel (always exists)
 * - #plan-{id}: Per-plan channels (created when plan is created)
 *
 * Channels are relay constructs - agents/users join to receive messages.
 */

import { getClient, isConnected, onStateChange, type ClientState } from './client.js';

/** Channel info for API responses */
export interface ChannelInfo {
  id: string;
  name: string;
  type: 'global' | 'plan';
  planId?: string;
  description?: string;
}

/** Global planner channel */
export const PLANNER_CHANNEL = '#planner';

/** Track registered channels (known to exist, not necessarily joined) */
const createdChannels = new Set<string>();

/** Track plan channels: planId -> channelId (registered, not necessarily joined) */
const planChannels = new Map<string, string>();

/** Track channels we've actually joined in the relay daemon */
const joinedChannels = new Set<string>();

/**
 * Get channel ID for a plan.
 */
export function getPlanChannelId(planId: string): string {
  return `#plan-${planId.slice(0, 8)}`;
}

/**
 * Get channel ID for an ideation session.
 */
export function getSessionChannelId(sessionId: string): string {
  return `#ideation-${sessionId.slice(0, 8)}`;
}

/**
 * Create the global #planner channel.
 * Called on server startup.
 */
export function createPlannerChannel(): boolean {
  const client = getClient();
  if (!client || !isConnected()) {
    console.log('[channels] Skipping #planner creation: relay not connected');
    return false;
  }

  // Join the channel as Relay (effectively creates it)
  const joined = client.joinChannel(PLANNER_CHANNEL, 'Relay');
  if (joined) {
    createdChannels.add(PLANNER_CHANNEL);
    console.log('[channels] Created #planner channel');
    return true;
  }

  console.warn('[channels] Failed to create #planner channel');
  return false;
}

/**
 * Create a channel for a specific plan.
 * Called when a new plan is created.
 */
export function createPlanChannel(planId: string, planTitle?: string): string | null {
  const client = getClient();
  if (!client || !isConnected()) {
    console.log(`[channels] Skipping plan channel creation for ${planId}: relay not connected`);
    return null;
  }

  const channelId = getPlanChannelId(planId);

  const channelAlreadyJoined = joinedChannels.has(channelId);

  // If already registered AND joined, nothing to do
  if (planChannels.has(planId) && channelAlreadyJoined) {
    return channelId;
  }

  // Join the channel (creates it if it doesn't exist)
  const displayName = planTitle ? `Plan: ${planTitle.slice(0, 30)}` : 'Planner Core';
  const joined = client.joinChannel(channelId, displayName);

  if (joined) {
    createdChannels.add(channelId);
    planChannels.set(planId, channelId);
    joinedChannels.add(channelId);
    console.log(`[channels] Joined channel ${channelId} for plan ${planId}`);
    return channelId;
  }

  console.warn(`[channels] Failed to create channel ${channelId} for plan ${planId}`);
  return null;
}

/**
 * Remove a plan channel.
 * Called when a plan is deleted (optional cleanup).
 */
export function removePlanChannel(planId: string): boolean {
  const client = getClient();
  if (!client || !isConnected()) {
    return false;
  }

  const channelId = planChannels.get(planId);
  if (!channelId) {
    return false;
  }

  const left = client.leaveChannel(channelId, 'Plan deleted');
  if (left) {
    createdChannels.delete(channelId);
    planChannels.delete(planId);
    joinedChannels.delete(channelId);
    console.log(`[channels] Removed channel ${channelId} for plan ${planId}`);
    return true;
  }

  return false;
}

/**
 * Get all channels accessible to a user.
 * Returns #planner plus all plan channels the user has access to.
 */
export function getChannelsForUser(planIds?: string[]): ChannelInfo[] {
  const channels: ChannelInfo[] = [];

  // Always include #planner
  channels.push({
    id: PLANNER_CHANNEL,
    name: 'Planner',
    type: 'global',
    description: 'General planning discussions',
  });

  // Include plan channels
  if (planIds) {
    for (const planId of planIds) {
      const channelId = planChannels.get(planId) || getPlanChannelId(planId);
      channels.push({
        id: channelId,
        name: channelId.slice(1), // Remove # prefix for display
        type: 'plan',
        planId,
      });
    }
  } else {
    // Return all known plan channels
    for (const [planId, channelId] of planChannels) {
      channels.push({
        id: channelId,
        name: channelId.slice(1),
        type: 'plan',
        planId,
      });
    }
  }

  return channels;
}

/**
 * Check if a channel exists.
 */
export function channelExists(channelId: string): boolean {
  return createdChannels.has(channelId);
}

/**
 * Get all created channels.
 */
export function getAllChannels(): string[] {
  return Array.from(createdChannels);
}

/**
 * Initialize channel management.
 * Creates #planner channel when relay becomes available.
 */
export function initChannelManagement(): void {
  // Try to create #planner now if connected
  if (isConnected()) {
    createPlannerChannel();
  }

  // Also create when connection becomes ready
  onStateChange((state: ClientState) => {
    if (state === 'READY') {
      // Recreate global channel after reconnection
      createPlannerChannel();

      // Only rejoin channels that were actively joined this session
      const client = getClient();
      if (client && joinedChannels.size > 0) {
        console.log(`[channels] Rejoining ${joinedChannels.size} active channels`);
        for (const channelId of joinedChannels) {
          client.joinChannel(channelId, 'Planner Core');
        }
      }
    }
  });

  console.log('[channels] Channel management initialized');
}

/**
 * Register plan channels in the local Map without joining them in the relay daemon.
 * Called on startup to populate channel lookups (getChannelsForUser, etc.)
 * without flooding the daemon with join requests.
 */
export function registerPlanChannels(planIds: string[]): void {
  for (const planId of planIds) {
    if (!planChannels.has(planId)) {
      const channelId = getPlanChannelId(planId);
      planChannels.set(planId, channelId);
      createdChannels.add(channelId);
    }
  }
  console.log(`[channels] Registered ${planIds.length} plan channels (lazy join)`);
}

/**
 * Ensure a plan channel is joined in the relay daemon.
 * Joins on-demand if not already joined. Use this before sending messages.
 */
export function ensurePlanChannelJoined(planId: string): string | null {
  const channelId = planChannels.get(planId) || getPlanChannelId(planId);
  if (joinedChannels.has(channelId)) return channelId;
  return createPlanChannel(planId);
}

/**
 * Join a user to a channel.
 * Returns true if successful, false if relay not connected.
 */
export function joinChannel(channelId: string, userId: string): boolean {
  const client = getClient();
  if (!client || !isConnected()) {
    console.log(`[channels] Skipping join to ${channelId}: relay not connected`);
    return false;
  }

  const joined = client.joinChannel(channelId, userId);
  if (joined) {
    console.log(`[channels] User ${userId} joined ${channelId}`);
    return true;
  }

  console.warn(`[channels] Failed to join user ${userId} to ${channelId}`);
  return false;
}
