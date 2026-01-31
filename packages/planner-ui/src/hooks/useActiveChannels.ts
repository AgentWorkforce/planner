import { useState, useEffect, useCallback, useRef } from 'react';
import { get } from '@/api/client';
import { useRelay } from '@/contexts';
import type { Channel, PlanSummary } from '@/types';

interface ChannelsResponse {
  channels: Channel[];
  mode: string;
}

interface PlansResponse {
  plans: PlanSummary[];
}

interface ChannelWithActivity extends Channel {
  lastActivityAt?: number;
  /** Display name for plan channels: "<plan goal> (#plan-xxx)" */
  displayName?: string;
}

const ACTIVITY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Track recently active channels (activity in last 5 minutes).
 *
 * Fetches initial channel list from API and tracks activity timestamps
 * based on incoming relay messages. Automatically filters to channels
 * with recent activity.
 *
 * @example
 * const { activeChannels, allChannels, isLoading, refresh } = useActiveChannels();
 */
export function useActiveChannels() {
  const [channels, setChannels] = useState<ChannelWithActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { connection } = useRelay();

  // Track activity timestamps
  const activityMap = useRef<Map<string, number>>(new Map());

  // Fetch initial channels and plans from API
  const fetchChannels = useCallback(async () => {
    try {
      // Fetch channels and plans in parallel
      const [channelsResponse, plansResponse] = await Promise.all([
        get<ChannelsResponse>('/channels'),
        get<PlansResponse>('/plans?include_attention=false').catch(() => ({ plans: [] })),
      ]);

      // Build a map of planId -> goal for quick lookup
      const planGoalMap = new Map<string, string>();
      for (const plan of plansResponse.plans) {
        planGoalMap.set(plan.plan_id, plan.goal);
      }

      // Enrich channels with displayName for plan channels
      const channelsWithActivity = channelsResponse.channels.map((ch) => {
        const displayName = formatChannelDisplayName(ch, planGoalMap);
        return {
          ...ch,
          displayName,
          lastActivityAt: activityMap.current.get(ch.id), // undefined if no messages seen
        };
      });
      setChannels(channelsWithActivity);
    } catch (err) {
      console.warn('[useActiveChannels] Failed to fetch channels:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update activity timestamp when message received
  const updateActivity = useCallback((channelId: string) => {
    const now = Date.now();
    activityMap.current.set(channelId, now);
    setChannels((prev) => {
      const idx = prev.findIndex((ch) => ch.id === channelId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastActivityAt: now };
        return updated;
      }
      return prev;
    });
  }, []);

  // Filter to active channels (activity within window)
  const activeChannels = channels.filter((ch) => {
    const lastActivity = ch.lastActivityAt || 0;
    return Date.now() - lastActivity < ACTIVITY_WINDOW_MS;
  });

  // Subscribe to channel messages for activity tracking
  useEffect(() => {
    const unsub = connection.onChannelMessage((msg) => {
      if (msg.channel) {
        updateActivity(msg.channel);
      }
    });
    return unsub;
  }, [connection, updateActivity]);

  // Initial fetch
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Periodic refresh to prune stale channels from view
  useEffect(() => {
    const interval = setInterval(() => {
      setChannels((prev) => [...prev]); // Force re-render to filter stale
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    activeChannels,
    allChannels: channels,
    isLoading,
    refresh: fetchChannels,
  };
}

/**
 * Extract plan ID from a plan channel name.
 * Handles formats: "#plan-xxx", "plan-xxx"
 * Returns null if not a plan channel.
 */
function extractPlanId(channelId: string): string | null {
  // Match #plan-{id} or plan-{id}
  const match = channelId.match(/^#?plan-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Format channel display name.
 * For plan channels: "<plan goal truncated> (#plan-xxx)"
 * For other channels: use the channel name as-is
 */
function formatChannelDisplayName(
  channel: Channel,
  planGoalMap: Map<string, string>
): string {
  const planId = extractPlanId(channel.id);

  if (planId) {
    const goal = planGoalMap.get(planId);
    if (goal) {
      // Truncate goal if too long (max ~30 chars for sidebar)
      const truncatedGoal = goal.length > 30 ? goal.slice(0, 27) + '...' : goal;
      return `${truncatedGoal} (${channel.name})`;
    }
  }

  // Default: use channel name
  return channel.name;
}
