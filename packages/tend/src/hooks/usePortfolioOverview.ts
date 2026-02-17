import { useState, useEffect, useCallback } from 'react';

export interface Suggestion {
  type: 'plan' | 'opportunity';
  plan_id: string | null;
  plan_goal: string;
  initiative_id: string | null;
  initiative_name: string | null;
  score: number;
  reasons: string[];
  project_id: string | null;
  phase: 'ideating' | 'planning' | 'forging' | null;
  cluster_id: string | null;
  cluster_label: string | null;
  signal_count: number;
}

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
