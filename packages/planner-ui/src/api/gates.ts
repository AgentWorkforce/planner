import type { PendingGate, GateApprovalInfo } from '@/types';

const ORCHESTRATOR_API_BASE = import.meta.env.VITE_ORCHESTRATOR_API_URL || '/api/orchestrator';

/**
 * Get pending gates for a plan execution.
 */
export async function getPendingGates(planId: string, runId: string): Promise<PendingGate[]> {
  try {
    const response = await fetch(
      `${ORCHESTRATOR_API_BASE}/runs/${runId}/gates/pending?plan_id=${planId}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to get pending gates: ${response.status}`);
    }

    const data = await response.json();
    return data.gates || [];
  } catch (error) {
    console.error('Failed to get pending gates:', error);
    return [];
  }
}

/**
 * Approve a gate.
 */
export async function approveGate(
  runId: string,
  stepId: string,
  approver?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${ORCHESTRATOR_API_BASE}/runs/${runId}/gates/${stepId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approver: approver || 'current-user',
        approved_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: error || `Approval failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to approve gate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Reject a gate.
 */
export async function rejectGate(
  runId: string,
  stepId: string,
  reason?: string,
  rejector?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${ORCHESTRATOR_API_BASE}/runs/${runId}/gates/${stepId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rejector: rejector || 'current-user',
        reason,
        rejected_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: error || `Rejection failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to reject gate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get approval history for a step's gate.
 */
export async function getGateHistory(
  runId: string,
  stepId: string
): Promise<GateApprovalInfo[]> {
  try {
    const response = await fetch(
      `${ORCHESTRATOR_API_BASE}/runs/${runId}/gates/${stepId}/history`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to get gate history: ${response.status}`);
    }

    const data = await response.json();
    return data.history || [];
  } catch (error) {
    console.error('Failed to get gate history:', error);
    return [];
  }
}

/**
 * Create mock pending gates for development.
 */
export function createMockPendingGates(steps: Array<{ step_id: string; title: string; description?: string; gate?: { type: string; approver_role?: string } }>): PendingGate[] {
  return steps
    .filter((step) => step.gate?.type === 'human_approval')
    .map((step) => ({
      step_id: step.step_id,
      step_title: step.title,
      step_description: step.description,
      gate: {
        type: 'human_approval' as const,
        approver_role: step.gate?.approver_role,
      },
      blocked_since: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    }));
}
