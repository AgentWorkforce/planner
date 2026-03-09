import { useState, useEffect, useCallback, useRef } from 'react';

export interface ExtractionResult {
  quotes: string[];
  entities: string[];
  aspects: string[];
  keywords: string[];
  questions?: Array<{ text: string; is_explicit: boolean }>;
  sentiment?: string;
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
  quality?: {
    depth_score: number;
    substantive_count: number;
    shallow_count: number;
    total: number;
  };
  demand?: {
    score: number;
    request_ratio: number;
    velocity_factor: number;
    quality_factor: number;
    label: string;
  };
  sentiment_distribution?: {
    frustrated: number;
    disappointed: number;
    neutral: number;
    hopeful: number;
    enthusiastic: number;
    dominant: string;
    total: number;
  };
  author_profiles?: Array<{
    id: string;
    author: string;
    author_type: string;
    signal_count: number;
    top_intents: string[];
    top_clusters: string[];
    segment: string | null;
  }>;
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
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!clusterId) {
      setCluster(null);
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cultivate/clusters/${clusterId}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setCluster(json.data ?? json);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [clusterId]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { cluster, loading, error, refetch: fetchData };
}
