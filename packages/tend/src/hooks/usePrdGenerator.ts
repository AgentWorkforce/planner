import { useState, useCallback } from 'react';

export interface UsePrdGeneratorResult {
  generate: (clusterId: string, greenhouseId: string) => Promise<void>;
  markdown: string | null;
  loading: boolean;
  error: Error | null;
}

export function usePrdGenerator(): UsePrdGeneratorResult {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async (clusterId: string, greenhouseId: string) => {
    setLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const response = await fetch('/api/cultivate/prd/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster_id: clusterId, greenhouse_id: greenhouseId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const json = await response.json();
      setMarkdown(json.data?.markdown ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, markdown, loading, error };
}
