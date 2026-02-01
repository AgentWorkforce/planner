import { useState, useEffect, useCallback } from 'react';
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
  const api = useIdeationApi();

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.getSession(sessionId);
      setSession(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [sessionId, api]);

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
