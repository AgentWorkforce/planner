import { useState, useCallback } from 'react';
import { createDmChannel } from '@/api/client';

/**
 * Hook for managing DM channel creation and tracking.
 * Provides a function to open DM channels with agents and tracks the active DM channel ID.
 */
export function useDmChannel() {
  const [activeDmChannelId, setActiveDmChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const openDm = useCallback(async (agentId: string, agentName: string): Promise<string> => {
    setIsLoading(true);
    try {
      const channel = await createDmChannel(agentId, agentName);
      setActiveDmChannelId(channel.id);
      return channel.id;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { openDm, activeDmChannelId, isLoading };
}
