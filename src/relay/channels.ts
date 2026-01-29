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

/** Track created channels */
const createdChannels = new Set<string>();

/** Track plan channels */
const planChannels = new Map<string, string>(); // planId -> channelId

/**
 * Get channel ID for a plan.
 */
export function getPlanChannelId(planId: string): string {
  return `#plan-${planId.slice(0, 8)}`;
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
