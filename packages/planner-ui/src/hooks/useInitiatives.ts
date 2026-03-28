import { useState, useEffect, useCallback } from 'react';
import { listInitiatives } from '../api/initiatives';
import type { InitiativeWithPlanCounts } from '../types/initiative';

// Event name for initiative data invalidation
const INITIATIVES_CHANGED_EVENT = 'initiatives-changed';

/**
 * Signal all useInitiatives hooks to refetch data.
 * Call this after creating, updating, or deleting an initiative.
 */
export function invalidateInitiatives(): void {
  window.dispatchEvent(new CustomEvent(INITIATIVES_CHANGED_EVENT));
}

interface UseInitiativesResult {
  /** List of initiatives with plan counts */
  initiatives: InitiativeWithPlanCounts[];
  /** Whether loading is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the initiatives list */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage initiatives data.
 *
 * All instances of this hook share data invalidation - when any component
 * calls invalidateInitiatives() or refresh(), all hook instances will refetch.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { initiatives, isLoading, error, refresh } = useInitiatives();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div>
 *       {initiatives.map(init => <div key={init.initiative_id}>{init.name}</div>)}
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInitiatives(): UseInitiativesResult {
  const [initiatives, setInitiatives] = useState<InitiativeWithPlanCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listInitiatives();
      setInitiatives(data.initiatives);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch initiatives';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for global invalidation events
  useEffect(() => {
    const handleInvalidation = () => {
      refresh();
    };

    window.addEventListener(INITIATIVES_CHANGED_EVENT, handleInvalidation);
    return () => {
      window.removeEventListener(INITIATIVES_CHANGED_EVENT, handleInvalidation);
    };
  }, [refresh]);

  return {
    initiatives,
    isLoading,
    error,
    refresh,
  };
}
