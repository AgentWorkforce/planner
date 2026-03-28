/**
 * Channel Management Module
 *
 * Local bookkeeping for relay channels used in planner communication:
 * - #planner: Global planning channel (always exists)
 * - #plan-{id}: Per-plan channels (created when plan is created)
 *
 * In relay SDK 3.x, channels are declared at spawn time — the server does not
 * join channels via the SDK. This module is purely local state used to answer
 * API queries (e.g., which channels exist, which channel belongs to a plan).
 * All operations always succeed regardless of relay connection status.
 */

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

/** Track registered channels (local bookkeeping only) */
const createdChannels = new Set<string>();

/** Track plan channels: planId -> channelId */
const planChannels = new Map<string, string>();

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
 * Register the global #planner channel in local state.
 * Called on server startup.
 */
export function createPlannerChannel(): boolean {
  createdChannels.add(PLANNER_CHANNEL);
  console.log('[channels] Registered #planner channel');
  return true;
}

/**
 * Register a channel for a specific plan in local state.
 * Called when a new plan is created.
 */
export function createPlanChannel(planId: string, planTitle?: string): string {
  const channelId = getPlanChannelId(planId);

  if (!planChannels.has(planId)) {
    createdChannels.add(channelId);
    planChannels.set(planId, channelId);
    const label = planTitle ? `Plan: ${planTitle.slice(0, 30)}` : channelId;
    console.log(`[channels] Registered channel ${channelId} for plan ${planId} (${label})`);
  }

  return channelId;
}

/**
 * Remove a plan channel from local state.
 * Called when a plan is deleted (optional cleanup).
 */
export function removePlanChannel(planId: string): boolean {
  const channelId = planChannels.get(planId);
  if (!channelId) {
    return false;
  }

  createdChannels.delete(channelId);
  planChannels.delete(planId);
  console.log(`[channels] Removed channel ${channelId} for plan ${planId}`);
  return true;
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
 * Check if a channel exists in local state.
 */
export function channelExists(channelId: string): boolean {
  return createdChannels.has(channelId);
}

/**
 * Get all registered channels.
 */
export function getAllChannels(): string[] {
  return Array.from(createdChannels);
}

/**
 * Initialize channel management.
 * Registers #planner in local state. No relay dependency.
 */
export function initChannelManagement(): void {
  createPlannerChannel();
  console.log('[channels] Channel management initialized');
}

/**
 * Register plan channels in local state without any relay interaction.
 * Called on startup to populate channel lookups (getChannelsForUser, etc.).
 */
export function registerPlanChannels(planIds: string[]): void {
  for (const planId of planIds) {
    if (!planChannels.has(planId)) {
      const channelId = getPlanChannelId(planId);
      planChannels.set(planId, channelId);
      createdChannels.add(channelId);
    }
  }
  console.log(`[channels] Registered ${planIds.length} plan channels`);
}

/**
 * Ensure a plan channel is registered in local state.
 * Delegates to createPlanChannel(), which is always a local operation.
 */
export function ensurePlanChannelJoined(planId: string): string {
  return createPlanChannel(planId);
}
