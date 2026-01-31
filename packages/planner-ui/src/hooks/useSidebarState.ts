import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'planner-sidebar-state';

interface SidebarState {
  collapsed: boolean;
  expandedInitiatives: string[];
}

const DEFAULT_STATE: SidebarState = {
  collapsed: false,
  expandedInitiatives: [],
};

/**
 * Validate that a value has the shape of SidebarState.
 */
function isValidSidebarState(value: unknown): value is SidebarState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const state = value as Record<string, unknown>;

  return (
    typeof state.collapsed === 'boolean' &&
    Array.isArray(state.expandedInitiatives) &&
    state.expandedInitiatives.every((item) => typeof item === 'string')
  );
}

/**
 * Read sidebar state from localStorage with validation.
 */
function readStoredState(): SidebarState {
  // SSR safety check
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidSidebarState(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Invalid/corrupt data, fall back to default
  }

  return DEFAULT_STATE;
}

/**
 * Write sidebar state to localStorage.
 */
function writeStoredState(state: SidebarState): void {
  // SSR safety check
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Hook to manage sidebar state with localStorage persistence.
 *
 * Manages:
 * - Sidebar collapsed/expanded state
 * - Which initiatives are expanded in the sidebar
 *
 * Features:
 * - Persists across page reloads
 * - Syncs across tabs via storage events
 * - SSR safe (handles missing window object)
 * - Validates stored data to prevent corruption issues
 */
export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(readStoredState);

  // Sync with localStorage on mount (handles hydration)
  useEffect(() => {
    const stored = readStoredState();
    setState(stored);
  }, []);

  // Sync across tabs using storage events
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (isValidSidebarState(parsed)) {
            setState(parsed);
          }
        } catch {
          // Invalid data, ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => {
      const next = { ...prev, collapsed };
      writeStoredState(next);
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, collapsed: !prev.collapsed };
      writeStoredState(next);
      return next;
    });
  }, []);

  const isInitiativeExpanded = useCallback(
    (id: string): boolean => {
      return state.expandedInitiatives.includes(id);
    },
    [state.expandedInitiatives]
  );

  const toggleInitiativeExpanded = useCallback((id: string) => {
    setState((prev) => {
      const expandedInitiatives = prev.expandedInitiatives.includes(id)
        ? prev.expandedInitiatives.filter((initiativeId) => initiativeId !== id)
        : [...prev.expandedInitiatives, id];

      const next = { ...prev, expandedInitiatives };
      writeStoredState(next);
      return next;
    });
  }, []);

  return {
    collapsed: state.collapsed,
    setCollapsed,
    toggleCollapsed,
    isInitiativeExpanded,
    toggleInitiativeExpanded,
  };
}
