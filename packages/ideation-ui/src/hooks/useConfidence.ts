import { useState, useEffect, useCallback } from 'react';
import { useIdeationApi } from './useIdeationApi';
import { useSessionEvents } from './useSessionEvents';

interface UseConfidenceResult {
  score: number;
  breakdown: Record<string, number>;
  loading: boolean;
}

export function useConfidence(sessionId: string | undefined): UseConfidenceResult {
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const api = useIdeationApi();

  const fetchConfidence = useCallback(async () => {
    if (!sessionId) {
      setScore(0);
      setBreakdown({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await api.getConfidence(sessionId);
      if (result) {
        setScore(result.score);
        setBreakdown(result.breakdown);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, api]);

  useEffect(() => {
    fetchConfidence();
  }, [fetchConfidence]);

  // Subscribe to confidence updates via SSE
  useSessionEvents(sessionId, {
    onConfidence: (newScore, newBreakdown) => {
      setScore(newScore);
      setBreakdown(newBreakdown);
    },
  });

  return {
    score,
    breakdown,
    loading,
  };
}
