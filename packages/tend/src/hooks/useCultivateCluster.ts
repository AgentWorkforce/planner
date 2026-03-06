import { useState, useEffect, useCallback } from 'react';

export interface ExtractionResult {
  quotes: string[];
  entities: string[];
  aspects: string[];
  keywords: string[];
}

export interface SignalWithExtraction {
  id: string;
  title: string;
  source_type: string;
  author: string;
  author_type: string;
  score: number;
  status: string;
  intent?: string;
  extraction?: ExtractionResult | null;
  created_at: string;
}

export interface ClusterDetail {
  id: string;
  greenhouse_id: string;
  label: string;
  signal_count: number;
  trend: string;
  created_at: string;
  updated_at: string;
  signals: SignalWithExtraction[];
}

export interface UseCultivateClusterResult {
  cluster: ClusterDetail | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCultivateCluster(clusterId: string | null): UseCultivateClusterResult {
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!clusterId) {
      setCluster(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cultivate/clusters/${clusterId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setCluster(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { cluster, loading, error, refetch: fetchData };
}
