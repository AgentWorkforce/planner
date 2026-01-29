import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'planner:recentPlans';
const MAX_RECENT = 5;

/**
 * Read recent plan IDs from localStorage.
 */
function readRecentPlans(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT);
      }
    }
  } catch {
    // localStorage unavailable or corrupted
  }
  return [];
}

/**
 * Write recent plan IDs to localStorage.
 */
function writeRecentPlans(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Hook that tracks recently viewed plans in localStorage.
 *
 * - Stores up to 5 plan IDs
 * - Most recently viewed appears first (LRU)
 * - Adding existing ID moves it to front (no duplicates)
 * - Gracefully handles localStorage unavailable
 */
export function useRecentPlans() {
  const [recentPlanIds, setRecentPlanIds] = useState<string[]>(readRecentPlans);

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = readRecentPlans();
    setRecentPlanIds(stored);
  }, []);

  const addRecent = useCallback((planId: string) => {
    setRecentPlanIds((prev) => {
      // Remove existing entry if present
      const filtered = prev.filter((id) => id !== planId);
      // Add to front
      const next = [planId, ...filtered].slice(0, MAX_RECENT);
      writeRecentPlans(next);
      return next;
    });
  }, []);

  return { recentPlanIds, addRecent };
}
