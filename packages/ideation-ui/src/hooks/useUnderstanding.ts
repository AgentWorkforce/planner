import { useState, useEffect, useCallback, useRef } from 'react';
import { useIdeationApi } from './useIdeationApi';
import { useSessionEvents } from './useSessionEvents';

interface ActiveSpecialist {
  name: string;
  roleHint?: string;
}

interface UseUnderstandingResult {
  understanding: Record<string, Record<string, unknown>>;
  activeSpecialists: ActiveSpecialist[];
  loading: boolean;
}

export function useUnderstanding(
  sessionId: string | undefined
): UseUnderstandingResult {
  const [understanding, setUnderstanding] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [activeSpecialists, setActiveSpecialists] = useState<ActiveSpecialist[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const { getSession } = useIdeationApi();

  // Use ref to get stable reference
  const getSessionRef = useRef(getSession);
  getSessionRef.current = getSession;

  const fetchUnderstanding = useCallback(async () => {
    if (!sessionId) {
      setUnderstanding({});
      setActiveSpecialists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const session = await getSessionRef.current(sessionId);
      if (session?.understanding) {
        setUnderstanding(session.understanding);
        // Extract active specialists from understanding keys
        const specialists = Object.keys(session.understanding).map((name) => ({
          name,
          roleHint: extractRoleHint(session.understanding[name]),
        }));
        setActiveSpecialists(specialists);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchUnderstanding();
  }, [fetchUnderstanding]);

  // Subscribe to understanding updates via SSE
  useSessionEvents(sessionId, {
    onUnderstanding: (newUnderstanding) => {
      setUnderstanding(newUnderstanding);
      // Update active specialists from new understanding
      const specialists = Object.keys(newUnderstanding).map((name) => ({
        name,
        roleHint: extractRoleHint(newUnderstanding[name]),
      }));
      setActiveSpecialists(specialists);
    },
  });

  return {
    understanding,
    activeSpecialists,
    loading,
  };
}

// Helper to extract role hint from observations
function extractRoleHint(
  observations: Record<string, unknown>
): string | undefined {
  const role = observations.role;
  if (typeof role === 'string') {
    return role;
  }
  const roleHint = observations.roleHint;
  if (typeof roleHint === 'string') {
    return roleHint;
  }
  return undefined;
}
