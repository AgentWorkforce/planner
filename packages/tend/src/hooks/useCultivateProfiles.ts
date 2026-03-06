import { useState, useEffect, useCallback } from 'react';

export interface Profile {
  id: string;
  author: string;
  author_type: string;
  signal_count: number;
  segment: string | null;
  top_intents: string[];
  top_clusters: string[];
  source_distribution: Record<string, number>;
  first_seen_at: string;
  last_seen_at: string;
}

export interface UseCultivateProfilesResult {
  profiles: Profile[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch ICP profiles for a greenhouse
 * Only fetches when greenhouseId is non-null
 */
export function useCultivateProfiles(greenhouseId: string | null): UseCultivateProfilesResult {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!greenhouseId) {
      setProfiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ greenhouse_id: greenhouseId });
      const response = await fetch(`/api/cultivate/profiles?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setProfiles(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [greenhouseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { profiles, loading, error, refetch: fetchData };
}
