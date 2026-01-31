import { useState, useEffect, useCallback } from 'react';
import { getInitiative, type Initiative } from '../api/initiatives';
import { listPlans, type PlanSummary } from '../api/plans';

interface UseInitiativeResult {
  /** Initiative details */
  initiative: Initiative | null;
  /** Plans associated with this initiative */
  plans: PlanSummary[];
  /** Whether loading is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the initiative and its plans */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch a single initiative with its associated plans.
 *
 * @param initiativeId - The ID of the initiative to fetch (undefined skips loading)
 *
 * @example
 * ```tsx
 * function InitiativeDetailPage() {
 *   const { id } = useParams();
 *   const { initiative, plans, isLoading, error, refresh } = useInitiative(id);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!initiative) return <div>Initiative not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{initiative.name}</h1>
 *       <p>{initiative.description}</p>
 *       <div>
 *         {plans.map(plan => <PlanCard key={plan.plan_id} plan={plan} />)}
 *       </div>
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInitiative(initiativeId: string | undefined): UseInitiativeResult {
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // If no initiative ID provided, reset state and skip loading
    if (!initiativeId) {
      setInitiative(null);
      setPlans([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch initiative and plans in parallel
      const [initiativeData, plansData] = await Promise.all([
        getInitiative(initiativeId),
        listPlans({ initiative_id: initiativeId, include_attention: true }),
      ]);

      setInitiative(initiativeData);
      setPlans(plansData.plans);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch initiative';
      setError(errorMessage);
      setInitiative(null);
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  // Fetch on mount and when initiativeId changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    initiative,
    plans,
    isLoading,
    error,
    refresh,
  };
}
