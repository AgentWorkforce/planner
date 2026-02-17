import { useState, useEffect, useCallback } from 'react';

export interface HealthScore {
  entity_type: 'initiative' | 'plan';
  entity_id: string;
  overall: number;
  signals: {
    recency: number;
    velocity: number;
    completeness: number;
    attention: number;
    decision_density: number;
    external_pressure: number;
    execution_health: number;
  };
  staleness_days: number;
  computed_at: string;
}

export interface UseInitiativeHealthResult {
  healthMap: Map<string, HealthScore>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useInitiativeHealth(): UseInitiativeHealthResult {
  const [healthMap, setHealthMap] = useState<Map<string, HealthScore>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/portfolio/health/initiatives');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const scores: HealthScore[] = json.health || [];
      const map = new Map<string, HealthScore>();
      scores.forEach(score => {
        map.set(score.entity_id, score);
      });
      setHealthMap(map);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { healthMap, loading, error, refetch: fetchData };
}
