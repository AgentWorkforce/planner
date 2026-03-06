import { useState, useEffect, useCallback } from 'react';

export interface SourcePreset {
  name: string;
  description: string;
  adapter_type: string;
  endpoint_template: string;
  poll_interval_ms: number;
  tags: string[];
  authority: number;
  tier: string;
}

export interface PresetEntry {
  id: string;
  preset: SourcePreset;
}

export interface UseCultivatePresetsResult {
  presets: PresetEntry[];
  loading: boolean;
  error: Error | null;
}

export function useCultivatePresets(): UseCultivatePresetsResult {
  const [presets, setPresets] = useState<PresetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cultivate/presets');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setPresets(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { presets, loading, error };
}
