import { useState, useEffect, useCallback, useRef } from 'react';
import { useIdeationApi } from './useIdeationApi';
import { useSessionEvents } from './useSessionEvents';
import { useUnderstanding } from './useUnderstanding';
import { aggregateSessionConfidence } from '@/lib/confidence-utils';

interface UseConfidenceResult {
  score: number;
  breakdown: Record<string, string>;
  bySpecialist: Record<string, number>;
  loading: boolean;
}

export function useConfidence(sessionId: string | undefined): UseConfidenceResult {
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string, string>>({});
  const [bySpecialist, setBySpecialist] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hasApiConfidence, setHasApiConfidence] = useState(false);
  const { getConfidence } = useIdeationApi();
  const { understanding, loading: understandingLoading } = useUnderstanding(sessionId);

  // Use ref to get stable reference
  const getConfidenceRef = useRef(getConfidence);
  getConfidenceRef.current = getConfidence;

  const fetchConfidence = useCallback(async () => {
    if (!sessionId) {
      setScore(0);
      setBreakdown({});
      setBySpecialist({});
      setHasApiConfidence(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await getConfidenceRef.current(sessionId);
      if (result) {
        setScore(result.score);
        setBreakdown(result.breakdown);
        setHasApiConfidence(true);
        // If API provides confidence, we still calculate bySpecialist from understanding
      } else {
        setHasApiConfidence(false);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchConfidence();
  }, [fetchConfidence]);

  // Subscribe to confidence updates via SSE
  useSessionEvents(sessionId, {
    onConfidence: (newScore, newBreakdown) => {
      setScore(newScore);
      setBreakdown(newBreakdown);
      setHasApiConfidence(true);
    },
  });

  // Calculate confidence from understanding when API doesn't provide it
  // Also always calculate bySpecialist from understanding
  useEffect(() => {
    if (!sessionId || understandingLoading) {
      return;
    }

    const calculated = aggregateSessionConfidence(understanding);
    setBySpecialist(calculated.bySpecialist);

    // Only use calculated score if API hasn't provided confidence
    if (!hasApiConfidence) {
      setScore(calculated.score);
    }
  }, [understanding, understandingLoading, sessionId, hasApiConfidence]);

  return {
    score,
    breakdown,
    bySpecialist,
    loading: loading || understandingLoading,
  };
}
