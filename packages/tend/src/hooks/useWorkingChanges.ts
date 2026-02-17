import { useState, useEffect, useMemo, useRef } from 'react';
import type { GitFileStatus } from '@/components/tree/git-types';

export interface ScopedChanges {
  scope: string;
  files: GitFileStatus[];
  stats: { modified: number; added: number; deleted: number; total: number };
}

export interface UseWorkingChangesReturn {
  changes: ScopedChanges[];
  branch: string | null;
  detachedHead?: string;
  isClean: boolean;
  available: boolean;
  loading: boolean;
  totalChanges: number;
  hasConflicts: boolean;
}

interface GitStatusResponse {
  files: GitFileStatus[];
  branch: string | null;
  detachedHead?: string;
  available: boolean;
  ahead: number;
  behind: number;
  hasConflicts: boolean;
}

export function inferScope(filePath: string): string {
  const match = filePath.match(/^packages\/([^/]+)\//);
  return match ? match[1] : 'root';
}

function computeStats(files: GitFileStatus[]) {
  const modified = files.filter(f => f.status === 'modified').length;
  const added = files.filter(f => f.status === 'added' || f.status === 'untracked').length;
  const deleted = files.filter(f => f.status === 'deleted').length;
  return { modified, added, deleted, total: files.length };
}

function groupByScope(files: GitFileStatus[]): ScopedChanges[] {
  const map = new Map<string, GitFileStatus[]>();

  for (const file of files) {
    const scope = inferScope(file.path);
    const existing = map.get(scope);
    if (existing) {
      existing.push(file);
    } else {
      map.set(scope, [file]);
    }
  }

  const entries = Array.from(map.entries()).map(([scope, scopeFiles]) => ({
    scope,
    files: scopeFiles,
    stats: computeStats(scopeFiles),
  }));

  return entries.sort((a, b) => {
    if (a.scope === 'root') return 1;
    if (b.scope === 'root') return -1;
    return a.scope.localeCompare(b.scope);
  });
}

const POLL_INTERVAL_MS = 5000;

export function useWorkingChanges(): UseWorkingChangesReturn {
  const [response, setResponse] = useState<GitStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const previousJsonRef = useRef<string | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/git/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GitStatusResponse = await res.json();

        const json = JSON.stringify(data);
        if (json !== previousJsonRef.current) {
          previousJsonRef.current = json;
          setResponse(data);
        }
      } catch (err) {
        console.warn('[useWorkingChanges] Failed to fetch git status:', err);
      } finally {
        setLoading(false);
      }
    }

    function startPolling() {
      fetchStatus();
      intervalId = setInterval(fetchStatus, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const changes = useMemo(
    () => groupByScope(response?.files ?? []),
    [response?.files]
  );

  const totalChanges = response?.files.length ?? 0;
  const hasConflicts = (response?.files ?? []).some(f => f.status === 'conflict');

  return {
    changes,
    branch: response?.branch ?? null,
    detachedHead: response?.detachedHead,
    isClean: totalChanges === 0,
    available: response?.available ?? true,
    loading,
    totalChanges,
    hasConflicts,
  };
}
