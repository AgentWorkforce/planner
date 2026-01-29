/**
 * usePresence Hook
 *
 * Tracks presence (who's online) in a channel.
 * Gets initial presence from REST API and updates from WebSocket.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { get } from '@/api/client';
import type { PresenceEntry, UsePresenceResult, UseRelayConnectionResult } from '@/types';

interface PresenceResponse {
  members: PresenceEntry[];
}

/**
 * Hook for tracking channel presence.
 *
 * @param connection - The relay connection from useRelayConnection
 * @param channelId - Channel ID to track presence for (null to disable)
 */
export function usePresence(
  connection: UseRelayConnectionResult,
  channelId: string | null
): UsePresenceResult {
  const [members, setMembers] = useState<PresenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track channel to avoid stale closures
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  // Fetch presence from REST API
  const fetchPresence = useCallback(async () => {
    if (!channelId) {
      setMembers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const encodedChannel = encodeURIComponent(channelId);
      const response = await get<PresenceResponse>(`/channels/${encodedChannel}/presence`);
      setMembers(response.members);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch presence';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  // Handle join events - update presence when members join
  useEffect(() => {
    const unsubscribe = connection.onJoined((joinedChannelId: string, joinedMembers: PresenceEntry[]) => {
      if (joinedChannelId === channelIdRef.current) {
        setMembers(joinedMembers);
      }
    });

    return unsubscribe;
  }, [connection]);

  // Handle presence updates from WebSocket
  useEffect(() => {
    const unsubscribe = connection.onPresenceUpdate((updatedChannelId: string, updatedMembers: PresenceEntry[]) => {
      if (updatedChannelId === channelIdRef.current) {
        setMembers(updatedMembers);
      }
    });

    return unsubscribe;
  }, [connection]);

  // Fetch presence on mount and when channel changes
  useEffect(() => {
    if (channelId && connection.isConnected) {
      fetchPresence();
    } else {
      setMembers([]);
    }
  }, [channelId, connection.isConnected, fetchPresence]);

  return {
    members,
    isLoading,
    error,
    refresh: fetchPresence,
  };
}
