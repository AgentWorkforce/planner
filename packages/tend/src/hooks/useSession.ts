import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionWithDetails, useIdeationApi } from './useIdeationApi';

interface UseSessionResult {
  session: SessionWithDetails | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSession(sessionId: string | undefined): UseSessionResult {
  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getSession } = useIdeationApi();

  // Use ref to get stable reference to getSession
  const getSessionRef = useRef(getSession);
  getSessionRef.current = getSession;

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getSessionRef.current(sessionId);
      setSession(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    session,
    loading,
    error,
    refetch: fetchSession,
  };
}
