import { useState, useEffect, useCallback, useRef } from 'react';
import { getSessionStatus, createSession, type SessionStatus } from '@/api/chat';

export type ConnectionStatus = 'loading' | 'connected' | 'demo';

interface UseAIConnectionStatusResult {
  /** Whether AI agent is connected */
  isConnected: boolean;
  /** Connection status: 'loading' | 'connected' | 'demo' */
  status: ConnectionStatus;
  /** Session details when connected */
  session: SessionStatus | null;
  /** Force refresh session status */
  refresh: () => void;
  /** Connect to AI agent (spawn new session) */
  connect: () => Promise<void>;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Connection error message, if any */
  connectError: string | null;
}

/**
 * Hook for checking AI connection status.
 * Polls the session endpoint to determine if a planning agent is active.
 *
 * @param planId - Plan ID to check session for
 * @param pollInterval - Polling interval in ms (default: 10000)
 */
export function useAIConnectionStatus(
  planId: string | null,
  pollInterval = 10000
): UseAIConnectionStatusResult {
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    if (!planId) {
      setStatus('demo');
      setSession(null);
      return;
    }

    try {
      const sessionStatus = await getSessionStatus(planId);
      setSession(sessionStatus);
      setStatus(sessionStatus.active ? 'connected' : 'demo');
    } catch {
      setStatus('demo');
      setSession(null);
    }
  }, [planId]);

  const refresh = useCallback(() => {
    checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async () => {
    // Guard: no-op if already connected, connecting, or no planId
    if (!planId || isConnecting || status === 'connected') {
      return;
    }

    setIsConnecting(true);
    setConnectError(null);

    try {
      const result = await createSession(planId);

      // Both success and alreadyConnected are treated as success
      if ('alreadyConnected' in result && result.alreadyConnected) {
        // Session already exists, just refresh to update state
        await checkStatus();
      } else {
        // New session created, refresh to update state
        await checkStatus();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setConnectError(message);
    } finally {
      setIsConnecting(false);
    }
  }, [planId, isConnecting, status, checkStatus]);

  // Initial check and polling
  useEffect(() => {
    // Initial check
    checkStatus();

    // Set up polling
    if (planId && pollInterval > 0) {
      intervalRef.current = setInterval(checkStatus, pollInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [planId, pollInterval, checkStatus]);

  // Reset on plan change (only if planId exists, otherwise immediately set demo)
  useEffect(() => {
    if (planId) {
      setStatus('loading');
      setSession(null);
    } else {
      setStatus('demo');
      setSession(null);
    }
  }, [planId]);

  return {
    isConnected: status === 'connected',
    status,
    session,
    refresh,
    connect,
    isConnecting,
    connectError,
  };
}
