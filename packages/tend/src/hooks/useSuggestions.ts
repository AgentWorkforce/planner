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
  top_quote?: string;
  intent_breakdown?: Record<string, number>;
}

export interface UseSuggestionsResult {
  suggestions: Suggestion[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSuggestions(): UseSuggestionsResult {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/portfolio/suggestions');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setSuggestions(json.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { suggestions, loading, error, refetch: fetchData };
}
