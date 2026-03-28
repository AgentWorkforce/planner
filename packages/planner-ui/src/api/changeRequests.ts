import { get, post } from './client';
import type { ChangeRequest, Step } from '@/types';

/**
 * Get pending change requests for a plan.
 */
export async function getChangeRequests(planId: string): Promise<ChangeRequest[]> {
  const response = await get<{ change_requests: ChangeRequest[] }>(
    `/plans/${planId}/change-requests`
  );
  return response.change_requests;
}

/**
 * Accept a change request, creating a new draft version.
 */
export async function acceptChangeRequest(
  planId: string,
  changeRequestId: string
): Promise<{ version: number }> {
  return post<{ version: number }>(
    `/plans/${planId}/change-requests/${changeRequestId}/accept`
  );
}

/**
 * Reject a change request.
 */
export async function rejectChangeRequest(
  planId: string,
  changeRequestId: string,
  reason?: string
): Promise<void> {
  await post(`/plans/${planId}/change-requests/${changeRequestId}/reject`, { reason });
}

/**
 * Create mock pending change requests for development.
 */
export function createMockChangeRequests(planId: string, steps: Step[]): ChangeRequest[] {
  const now = new Date().toISOString();
  const existingStep = steps[0];

  return [
    {
      change_request_id: crypto.randomUUID(),
      run_id: 'run-001',
      plan_id: planId,
      reason:
        'Missing dependency: the "Deploy to staging" step should depend on "Run integration tests" to ensure tests pass before deployment.',
      suggested_changes: {
        modify_steps: existingStep
          ? [
              {
                step_id: existingStep.step_id,
                dependencies: [...existingStep.dependencies, steps[1]?.step_id || ''],
              },
            ]
          : [],
      },
      status: 'pending',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      change_request_id: crypto.randomUUID(),
      run_id: 'run-002',
      plan_id: planId,
      reason:
        'Missing step: Need to add a "Notify stakeholders" step after deployment to keep the team informed.',
      suggested_changes: {
        add_steps: [
          {
            step_id: crypto.randomUUID(),
            title: 'Notify stakeholders',
            description: 'Send notification to all stakeholders about the deployment completion.',
            scope: steps[0]?.scope,
            dependencies: existingStep ? [existingStep.step_id] : [],
            owner_role: 'communications:Sender',
          },
        ],
      },
      status: 'pending',
      created_at: now,
      updated_at: now,
    },
  ];
}
