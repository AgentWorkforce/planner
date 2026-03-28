import { useState, useEffect, useCallback } from 'react';

export interface Greenhouse {
  id: string;
  name: string;
  description?: string;
  mode: string;
  source_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface UseCultivateGreenhousesResult {
  greenhouses: Greenhouse[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCultivateGreenhouses(): UseCultivateGreenhousesResult {
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cultivate/greenhouses');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setGreenhouses(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { greenhouses, loading, error, refetch: fetchData };
}
