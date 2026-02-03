import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, useIdeationApi } from './useIdeationApi';

interface UseSessionsResult {
  sessions: Session[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getSessions } = useIdeationApi();

  // Use ref to get stable reference
  const getSessionsRef = useRef(getSessions);
  getSessionsRef.current = getSessions;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSessionsRef.current();
      // Sort by updated_at DESC (most recent first)
      const sorted = [...result].sort((a, b) => {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      setSessions(sorted);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
  };
}
