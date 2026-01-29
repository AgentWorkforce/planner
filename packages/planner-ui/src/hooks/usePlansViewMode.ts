import { useState, useCallback, useEffect } from 'react';
import type { PlansViewMode } from '@/components/PlansViewModeToggle';

const STORAGE_KEY = 'planner-plans-view-mode';
const DEFAULT_MODE: PlansViewMode = 'list';

/**
 * Validate that a value is a valid PlansViewMode.
 */
function isValidViewMode(value: unknown): value is PlansViewMode {
  return value === 'list' || value === 'grouped';
}

/**
 * Read view mode from localStorage with validation.
 */
function readStoredViewMode(): PlansViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidViewMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable, fall back to default
  }
  return DEFAULT_MODE;
}

/**
 * Hook to persist the user's preferred view mode (list vs grouped) to localStorage.
 *
 * - Default: 'list' (flat list)
 * - Falls back to 'list' if localStorage is corrupted/empty
 * - Persists across page reloads
 */
export function usePlansViewMode() {
  const [viewMode, setViewModeState] = useState<PlansViewMode>(readStoredViewMode);

  const setViewMode = useCallback((mode: PlansViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable, state still updates
    }
  }, []);

  // Sync with localStorage on mount (handles hydration)
  useEffect(() => {
    const stored = readStoredViewMode();
    if (stored !== viewMode) {
      setViewModeState(stored);
    }
  }, []);

  return { viewMode, setViewMode };
}
