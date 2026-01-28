import { z } from 'zod';
import { PlanStatus } from './status.js';

/**
 * Approval info recorded when a version is approved.
 */
export const ApprovalInfoSchema = z.object({
  approver: z.string().min(1),
  approved_at: z.string().datetime(),
});

export type ApprovalInfo = z.infer<typeof ApprovalInfoSchema>;

/**
 * Workflow transition result.
 */
export interface TransitionResult {
  valid: boolean;
  error?: string;
}

/**
 * Valid workflow transitions.
 * - draft -> approved (with optional submit step)
 * - approved -> published
 */
const VALID_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  [PlanStatus.Draft]: [PlanStatus.Approved],
  [PlanStatus.Approved]: [PlanStatus.Published],
  [PlanStatus.Published]: [],
};

/**
 * Check if a transition from one status to another is valid.
 */
export function canTransition(
  from: PlanStatus,
  to: PlanStatus
): TransitionResult {
  const validTargets = VALID_TRANSITIONS[from];
  if (validTargets.includes(to)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Cannot transition from '${from}' to '${to}'`,
  };
}

/**
 * Validate that a version is in draft status for submission.
 */
export function canSubmit(status: PlanStatus, submittedAt?: string): TransitionResult {
  if (status !== PlanStatus.Draft) {
    return {
      valid: false,
      error: `Cannot submit version in '${status}' status`,
    };
  }
  if (submittedAt) {
    return {
      valid: false,
      error: 'Version is already submitted',
    };
  }
  return { valid: true };
}

/**
 * Validate that a version can be approved.
 */
export function canApprove(status: PlanStatus, submittedAt?: string): TransitionResult {
  if (status !== PlanStatus.Draft) {
    return {
      valid: false,
      error: `Cannot approve version in '${status}' status`,
    };
  }
  if (!submittedAt) {
    return {
      valid: false,
      error: 'Version must be submitted before approval',
    };
  }
  return { valid: true };
}

/**
 * Validate that a version can be published.
 */
export function canPublish(status: PlanStatus): TransitionResult {
  const result = canTransition(status, PlanStatus.Published);
  if (!result.valid) {
    return {
      valid: false,
      error: `Cannot publish version in '${status}' status. Version must be approved first.`,
    };
  }
  return { valid: true };
}

/**
 * Generate plan_ref for orchestrator consumption.
 * Format: plan_id:version
 */
export function generatePlanRef(planId: string, version: number): string {
  return `${planId}:${version}`;
}
