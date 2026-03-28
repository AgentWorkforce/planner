/**
 * Improvements API client
 *
 * Functions for fetching and managing AI-suggested improvements.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** API response type for improvements (from backend) */
export interface ApiImprovement {
  improvement_id: string;
  plan_id: string;
  type: 'missing_criteria' | 'unclear_description' | 'missing_dependency' | 'redundant_step' | 'scope_suggestion';
  description: string;
  step_id?: string;
  suggested_change: {
    tool: string;
    arguments: Record<string, unknown>;
  };
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
}

export interface ImprovementsResponse {
  improvements: ApiImprovement[];
  session_status: 'active' | 'none';
}

export interface ApplyResponse {
  success: boolean;
  plan_version?: number;
  error?: string;
}

export interface DismissResponse {
  success: boolean;
  error?: string;
}

/**
 * Get pending improvements for a plan.
 *
 * @param planId - Plan ID to get improvements for
 * @returns List of pending improvements and session status
 */
export async function getImprovements(planId: string): Promise<ImprovementsResponse> {
  const response = await fetch(`${API_BASE}/plans/${planId}/improvements`);

  if (!response.ok) {
    if (response.status === 404) {
      return { improvements: [], session_status: 'none' };
    }
    throw new Error(`Failed to fetch improvements: ${response.status}`);
  }

  return response.json();
}

/**
 * Apply an improvement suggestion.
 *
 * @param planId - Plan ID
 * @param improvementId - Improvement ID to apply
 * @returns Result of applying the improvement
 */
export async function applyImprovement(
  planId: string,
  improvementId: string
): Promise<ApplyResponse> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/improvements/${improvementId}/apply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    return { success: false, error: error.message || `Failed: ${response.status}` };
  }

  return response.json();
}

/**
 * Dismiss an improvement suggestion.
 *
 * @param planId - Plan ID
 * @param improvementId - Improvement ID to dismiss
 * @returns Result of dismissing the improvement
 */
export async function dismissImprovement(
  planId: string,
  improvementId: string
): Promise<DismissResponse> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/improvements/${improvementId}/dismiss`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    return { success: false, error: error.message || `Failed: ${response.status}` };
  }

  return response.json();
}
