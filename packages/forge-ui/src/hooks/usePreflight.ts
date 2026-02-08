/**
 * usePreflight - Hook for managing preflight state
 *
 * Fetches plan data, runs validation, and manages loading/error states.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getPlanForPreflight,
  validatePreflight,
  checkPlannerAvailability,
} from '@/api/preflight';
import type { ForgePlan, PreflightCheck, PreflightValidationResult } from '@/types';

interface UsePreflightResult {
  /** The fetched plan data */
  plan: ForgePlan | null;
  /** Results of preflight checks */
  checks: PreflightCheck[];
  /** Whether all checks passed (no failures) */
  isValid: boolean;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether the Planner API is reachable */
  plannerAvailable: boolean;
  /** Refetch plan and revalidate */
  revalidate: () => Promise<void>;
}

export function usePreflight(planId: string, version?: number): UsePreflightResult {
  const [plan, setPlan] = useState<ForgePlan | null>(null);
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plannerAvailable, setPlannerAvailable] = useState(true);

  const fetchAndValidate = useCallback(async () => {
    if (!planId) {
      setError('No plan ID provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Set checks to pending state
    setChecks([
      { id: 'loading', name: 'Loading plan...', status: 'pending' },
    ]);

    try {
      // Check if Planner API is available
      const isAvailable = await checkPlannerAvailability();
      setPlannerAvailable(isAvailable);

      if (!isAvailable) {
        setError('Planner API is not available. Please ensure the Planner backend is running.');
        setChecks([
          {
            id: 'planner-api',
            name: 'Planner API Available',
            status: 'fail',
            message: 'Could not connect to Planner API',
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Fetch plan data (with optional version)
      const planData = await getPlanForPreflight(planId, version);
      setPlan(planData);

      // Run validation
      const validationResult: PreflightValidationResult = await validatePreflight(planId);
      setChecks(validationResult.checks);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load plan';
      setError(message);
      setChecks([
        {
          id: 'fetch-error',
          name: 'Plan Fetch',
          status: 'fail',
          message,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [planId, version]);

  // Initial fetch
  useEffect(() => {
    fetchAndValidate();
  }, [fetchAndValidate]);

  // Compute isValid from checks
  const isValid = checks.length > 0 && checks.every((c) => c.status !== 'fail');

  return {
    plan,
    checks,
    isValid,
    isLoading,
    error,
    plannerAvailable,
    revalidate: fetchAndValidate,
  };
}
