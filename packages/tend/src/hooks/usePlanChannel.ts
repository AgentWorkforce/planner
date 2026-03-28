import { useRelayChannel } from './useRelayChannel';
import type { UseRelayChannelResult } from './useRelayChannel';

/**
 * Relay channel hook for plan channels.
 * Computes channel ID from planId and delegates to useRelayChannel.
 */
export function usePlanChannel(planId: string | undefined): UseRelayChannelResult {
  const channelId = planId ? `#plan-${planId.slice(0, 8)}` : undefined;
  return useRelayChannel({ channelId });
}
