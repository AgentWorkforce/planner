import { useState, useEffect } from 'react';
import type { GitCommit } from '@/components/tree/git-types';

export interface UseCommitLogReturn {
  commits: GitCommit[];
  loading: boolean;
}

export function useCommitLog(refreshTrigger?: number): UseCommitLogReturn {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLog() {
      setLoading(true);
      try {
        const res = await fetch('/api/git/log?limit=20');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { commits: GitCommit[] } = await res.json();
        if (!cancelled) {
          setCommits(data.commits);
        }
      } catch (err) {
        console.warn('[useCommitLog] Failed to fetch git log:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLog();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return { commits, loading };
}
