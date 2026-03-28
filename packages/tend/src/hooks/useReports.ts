import { useState, useCallback, useRef } from 'react';

export interface UseReportGeneratorResult {
  generate: (greenhouseId: string, title?: string) => Promise<void>;
  markdown: string | null;
  loading: boolean;
  error: Error | null;
}

export function useReportGenerator(): UseReportGeneratorResult {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (greenhouseId: string, title?: string) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const response = await fetch('/api/cultivate/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greenhouse_id: greenhouseId, title }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const json = await response.json();
      setMarkdown(json.data?.markdown_content ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  return { generate, markdown, loading, error };
}
