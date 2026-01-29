import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'planner-collapsed-scopes';

/**
 * Read collapsed scopes from localStorage.
 */
function readCollapsedScopes(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch {
    // Invalid/corrupt data, return empty set (all expanded)
  }
  return new Set();
}

/**
 * Write collapsed scopes to localStorage.
 */
function writeCollapsedScopes(collapsed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Hook to manage which scope groups are expanded/collapsed, persisting to localStorage.
 *
 * - Default: all expanded (empty collapsed set)
 * - Stores collapsed scope names in localStorage
 * - Collapse state persists across page reloads
 */
export function useScopeGroupExpansion() {
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(readCollapsedScopes);

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = readCollapsedScopes();
    setCollapsedScopes(stored);
  }, []);

  const isExpanded = useCallback(
    (scopeName: string): boolean => {
      return !collapsedScopes.has(scopeName);
    },
    [collapsedScopes]
  );

  const toggleExpansion = useCallback((scopeName: string) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeName)) {
        next.delete(scopeName);
      } else {
        next.add(scopeName);
      }
      writeCollapsedScopes(next);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedScopes(new Set());
    writeCollapsedScopes(new Set());
  }, []);

  const collapseAll = useCallback((scopeNames: string[]) => {
    const allCollapsed = new Set(scopeNames);
    setCollapsedScopes(allCollapsed);
    writeCollapsedScopes(allCollapsed);
  }, []);

  return {
    isExpanded,
    toggleExpansion,
    expandAll,
    collapseAll,
  };
}
