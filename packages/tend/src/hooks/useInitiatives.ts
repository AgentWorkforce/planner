import { useState, useEffect, useCallback } from 'react';

/**
 * Initiative type matching planner backend
 */
export interface Initiative {
  initiative_id: string;
  org_id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  icon?: string;
  color?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface UseInitiativesResult {
  initiatives: Initiative[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const API_BASE_URL = '/api/planner';

/**
 * useInitiatives
 *
 * Fetch initiatives from planner API for displaying initiative labels and colors.
 *
 * @returns Initiative list with loading/error states
 *
 * @example
 * ```tsx
 * const { initiatives, loading, error } = useInitiatives();
 * const initiative = initiatives.find(i => i.initiative_id === session.initiative_id);
 * ```
 */
export function useInitiatives(): UseInitiativesResult {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInitiatives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/initiatives`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      // Sort by display_order
      const sorted = [...data].sort((a, b) => a.display_order - b.display_order);
      setInitiatives(sorted);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitiatives();
  }, [fetchInitiatives]);

  return {
    initiatives,
    loading,
    error,
    refetch: fetchInitiatives,
  };
}
