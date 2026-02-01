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
  type: 'global' | 'plan' | 'dm';
  planId?: string;
  agentId?: string; // For DM channels - target agent ID
  agentName?: string; // For DM channels - display name
  description?: string;
}

/** Global planner channel */
export const PLANNER_CHANNEL = '#planner';

/** Track created channels */
const createdChannels = new Set<string>();

/** Track plan channels */
const planChannels = new Map<string, string>(); // planId -> channelId

/** Track DM channels */
const dmChannels = new Map<string, ChannelInfo>(); // channelId -> ChannelInfo

/**
 * Get channel ID for a plan.
 */
export function getPlanChannelId(planId: string): string {
  return `#plan-${planId.slice(0, 8)}`;
}

/**
 * Get channel ID for a DM between user and agent.
 */
export function getDmChannelId(userSessionId: string, agentId: string): string {
  return `#dm-${userSessionId}-${agentId}`;
}

/**
 * Create a DM channel between user and agent.
 * Called when user initiates DM with an agent.
 */
export function createDmChannel(
  userSessionId: string,
  agentId: string,
  agentName: string
): ChannelInfo | null {
  const client = getClient();
  if (!client || !isConnected()) {
    console.log(`[channels] Skipping DM channel creation: relay not connected`);
    return null;
  }

  const channelId = getDmChannelId(userSessionId, agentId);

  // Check if already created
  if (dmChannels.has(channelId)) {
    console.log(`[channels] DM channel ${channelId} already exists`);
    return dmChannels.get(channelId)!;
  }

  // Join the channel (creates it if it doesn't exist)
  const displayName = 'Planner Core';
  const joined = client.joinChannel(channelId, displayName);

  if (joined) {
    const channelInfo: ChannelInfo = {
      id: channelId,
      name: `DM with ${agentName}`,
      type: 'dm',
      agentId,
      agentName,
    };

    createdChannels.add(channelId);
    dmChannels.set(channelId, channelInfo);
    console.log(`[channels] Created DM channel ${channelId} for ${agentName}`);
    return channelInfo;
  }

  console.warn(`[channels] Failed to create DM channel ${channelId}`);
  return null;
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

  // Join the channel as planner-core (effectively creates it)
  const joined = client.joinChannel(PLANNER_CHANNEL, 'Planner Core');
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

  // Check if already created
  if (planChannels.has(planId)) {
    console.log(`[channels] Plan channel ${channelId} already exists`);
    return channelId;
  }

  // Join the channel (creates it if it doesn't exist)
  const displayName = planTitle ? `Plan: ${planTitle.slice(0, 30)}` : 'Planner Core';
  const joined = client.joinChannel(channelId, displayName);

  if (joined) {
    createdChannels.add(channelId);
    planChannels.set(planId, channelId);
    console.log(`[channels] Created channel ${channelId} for plan ${planId}`);
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
    console.log(`[channels] Removed channel ${channelId} for plan ${planId}`);
    return true;
  }

  return false;
}

/**
 * Get all channels accessible to a user.
 * Returns #planner plus plan channels and DM channels.
 *
 * @param planIds - If provided, include channels for these plan IDs.
 *                  If not provided, only returns active plan channels (in planChannels map).
 * @param userSessionId - If provided, include DM channels for this user.
 */
export function getChannelsForUser(
  planIds?: string[],
  userSessionId?: string
): ChannelInfo[] {
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
    // Return channels for specific plan IDs
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
    // Return only active plan channels (ones we've actually joined)
    for (const [planId, channelId] of planChannels) {
      channels.push({
        id: channelId,
        name: channelId.slice(1),
        type: 'plan',
        planId,
      });
    }
  }

  // Include DM channels for this user
  if (userSessionId) {
    for (const [channelId, channelInfo] of dmChannels) {
      if (channelId.includes(userSessionId)) {
        channels.push(channelInfo);
      }
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
      // Recreate channels after reconnection
      createPlannerChannel();

      // Rejoin existing plan channels
      for (const [planId] of planChannels) {
        const channelId = getPlanChannelId(planId);
        const client = getClient();
        if (client) {
          client.joinChannel(channelId, 'Planner Core');
          console.log(`[channels] Rejoined channel ${channelId}`);
        }
      }
    }
  });

  console.log('[channels] Channel management initialized');
}

/**
 * Sync plan channels with storage.
 * Call this on startup to create channels for existing plans.
 */
export function syncPlanChannels(planIds: string[]): void {
  if (!isConnected()) {
    console.log('[channels] Skipping plan channel sync: relay not connected');
    return;
  }

  for (const planId of planIds) {
    if (!planChannels.has(planId)) {
      createPlanChannel(planId);
    }
  }

  console.log(`[channels] Synced ${planIds.length} plan channels`);
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
