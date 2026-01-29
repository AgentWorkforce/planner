import type { ExecutionStatus } from '@/types';

/**
 * Orchestrator API base URL.
 * In production, this would be configured via environment variable.
 */
const ORCHESTRATOR_API_BASE = '/api/orchestrator';

/**
 * Fetches execution status for a published plan from the orchestrator.
 *
 * @param planId - The plan ID
 * @param version - The version number
 * @returns ExecutionStatus if available, null if not found or orchestrator unavailable
 */
export async function getExecutionStatus(
  planId: string,
  version: number
): Promise<ExecutionStatus | null> {
  try {
    const response = await fetch(
      `${ORCHESTRATOR_API_BASE}/plans/${planId}/versions/${version}/status`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.status === 404) {
      // No execution status available (plan not yet running)
      return null;
    }

    if (!response.ok) {
      // Orchestrator unavailable or error - fail gracefully
      console.warn(
        `Failed to fetch execution status: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();
    return data.execution as ExecutionStatus;
  } catch (error) {
    // Network error or orchestrator unavailable - fail gracefully
    console.warn('Failed to fetch execution status:', error);
    return null;
  }
}

/**
 * Creates a mock execution status for testing/development.
 * Used when orchestrator is not available.
 *
 * @param planId - The plan ID
 * @param version - The version number
 * @param steps - Array of step IDs
 * @returns Mock ExecutionStatus
 */
export function createMockExecutionStatus(
  planId: string,
  version: number,
  stepIds: string[]
): ExecutionStatus {
  // For testing, distribute steps across statuses
  const statuses = ['done', 'running', 'pending', 'blocked', 'failed'] as const;
  const steps = stepIds.map((step_id, index) => ({
    step_id,
    status: statuses[index % statuses.length],
    started_at: index === 1 ? new Date().toISOString() : undefined,
    completed_at: index === 0 ? new Date().toISOString() : undefined,
  }));

  const progress = {
    total: stepIds.length,
    done: steps.filter((s) => s.status === 'done').length,
    running: steps.filter((s) => s.status === 'running').length,
    pending: steps.filter((s) => s.status === 'pending').length,
    blocked: steps.filter((s) => s.status === 'blocked').length,
    failed: steps.filter((s) => s.status === 'failed').length,
  };

  return {
    plan_id: planId,
    version,
    run_id: `run-${Date.now()}`,
    status: progress.done === progress.total ? 'completed' : 'running',
    steps,
    progress,
    started_at: new Date().toISOString(),
  };
}
