import { useState, useEffect, useCallback } from 'react';
import type { Suggestion } from './useSuggestions';

export interface PortfolioOverview {
  initiative_count: number;
  active_plan_count: number;
  health_summary: { healthy: number; warning: number; critical: number };
  top_suggestion: Suggestion | null;
  opportunity_count: number;
}

export interface UsePortfolioOverviewResult {
  overview: PortfolioOverview | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}


export function usePortfolioOverview(): UsePortfolioOverviewResult {
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/portfolio/overview');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setOverview(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { overview, loading, error, refetch: fetchData };
}
