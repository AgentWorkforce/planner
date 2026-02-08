import { useState, useEffect, useCallback } from 'react';

/**
 * Step interface matching ProjectTree expectations
 */
export interface Step {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  execution_status?: 'pending' | 'running' | 'done' | 'blocked' | 'failed';
}

/**
 * Plan version response from API
 */
interface PlanVersion {
  plan_id: string;
  version: number;
  status: string;
  summary: { goal: string; context?: string };
  steps: Step[];
}

interface PlanResponse {
  plan: Record<string, unknown>;
  version: PlanVersion;
}

/**
 * Hook return type
 */
export interface UsePlanStepsReturn {
  steps: Step[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * usePlanSteps - Fetch plan steps from the planner API
 *
 * Fetches plan details from GET /api/plans/{planId} and extracts
 * the steps array from the version object.
 *
 * @param planId - The plan ID to fetch steps for
 * @param refreshKey - Optional key that triggers refetch when changed (e.g. after graduation)
 * @returns steps, loading, error, and refetch function
 */
export function usePlanSteps(planId: string | undefined, refreshKey?: number): UsePlanStepsReturn {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    if (!planId) {
      setSteps([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plans/${planId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PlanResponse = await response.json();
      setSteps(data.version?.steps || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch plan steps';
      setError(message);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps, refreshKey]);

  const refetch = useCallback(() => {
    fetchSteps();
  }, [fetchSteps]);

  return { steps, loading, error, refetch };
}
