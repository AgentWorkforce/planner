/**
 * useChannels Hook
 *
 * Manages channel list and join/leave state.
 * Fetches available channels from REST API and tracks joined channels.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { get } from '@/api/client';
import type { Channel, PresenceEntry, UseChannelsResult } from '@/types';
import type { UseRelayConnectionResult } from '@/types';

interface ChannelsResponse {
  channels: Channel[];
}

/**
 * Hook for managing relay channels.
 *
 * @param connection - The relay connection from useRelayConnection
 * @param planId - Optional plan ID to filter channels
 */
export function useChannels(
  connection: UseRelayConnectionResult,
  planId?: string | null
): UseChannelsResult {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinedChannels, setJoinedChannels] = useState<Set<string>>(new Set());

  // Track joined channels ref to avoid stale closures
  const joinedChannelsRef = useRef(joinedChannels);
  joinedChannelsRef.current = joinedChannels;

  // Track pending joins to prevent duplicate join requests before server confirms
  const pendingJoinsRef = useRef<Set<string>>(new Set());

  // Fetch channels from REST API
  const fetchChannels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get userId for DM channel fetching (same source as createDmChannel)
      const userId = sessionStorage.getItem('relay_anonymous_user_id') || '';

      // Build query params
      // Use activeOnly=true to get #planner, active plan channels, and DMs only
      const params = new URLSearchParams();
      params.append('activeOnly', 'true');
      if (planId) params.append('planId', planId);
      if (userId) params.append('userId', userId);

      const url = `/channels?${params.toString()}`;
      const response = await get<ChannelsResponse>(url);
      setChannels(response.channels);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch channels';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  // Join a channel
  const join = useCallback(
    (channelId: string) => {
      if (!connection.isConnected) return;
      if (joinedChannelsRef.current.has(channelId)) return;
      if (pendingJoinsRef.current.has(channelId)) return; // Already joining

      pendingJoinsRef.current.add(channelId);
      connection.joinChannel(channelId);
    },
    [connection]
  );

  // Leave a channel
  const leave = useCallback(
    (channelId: string) => {
      if (!connection.isConnected) return;
      if (!joinedChannelsRef.current.has(channelId)) return;

      connection.leaveChannel(channelId);
    },
    [connection]
  );

  // Handle join confirmations
  useEffect(() => {
    const unsubscribe = connection.onJoined((channelId: string, _members: PresenceEntry[]) => {
      // Clear pending state now that join is confirmed
      pendingJoinsRef.current.delete(channelId);
      setJoinedChannels((prev) => {
        const next = new Set(prev);
        next.add(channelId);
        return next;
      });
    });

    return unsubscribe;
  }, [connection]);

  // Handle leave confirmations
  useEffect(() => {
    const unsubscribe = connection.onLeft((channelId: string) => {
      setJoinedChannels((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    });

    return unsubscribe;
  }, [connection]);

  // Fetch channels on mount and when planId changes
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Reset channel state on disconnect (server forgets membership on reconnect)
  useEffect(() => {
    if (!connection.isConnected) {
      pendingJoinsRef.current.clear();
      setJoinedChannels(new Set());
    }
  }, [connection.isConnected]);

  // Auto-join plan channel when connected and planId is available
  useEffect(() => {
    if (connection.isConnected && planId && channels.length > 0) {
      // Find the plan-specific channel
      const planChannel = channels.find((ch) => ch.type === 'plan' && ch.planId === planId);
      if (planChannel) {
        // Use the join function which handles deduplication via pendingJoinsRef
        join(planChannel.id);
      }
    }
  }, [connection.isConnected, planId, channels, join]);

  return {
    channels,
    isLoading,
    error,
    refresh: fetchChannels,
    joinedChannels,
    join,
    leave,
  };
}
