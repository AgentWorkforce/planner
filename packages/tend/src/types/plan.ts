/**
 * Plan types for tend
 * Simplified from planner-ui types - only what's needed for project tree
 */

export type PlanStatus = 'draft' | 'approved' | 'published';

export type StepExecutionStatus = 'pending' | 'running' | 'done' | 'blocked' | 'failed';

export interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

export interface Gate {
  type: 'human_approval';
  approver_role?: string;
}

export interface Step {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: Gate;
  sub_plan_id?: string;
}

export interface Summary {
  goal: string;
  context?: string;
}

export interface ApprovalInfo {
  approver: string;
  approved_at: string;
}

export interface PlanVersion {
  plan_id: string;
  version: number;
  status: PlanStatus;
  summary: Summary;
  steps: Step[];
  submitted_at?: string;
  approval_info?: ApprovalInfo;
  change_request_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StepExecutionInfo {
  step_id: string;
  status: StepExecutionStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

// Type guards for execution status
export function isStepDone(status: StepExecutionStatus): boolean {
  return status === 'done';
}

export function isStepRunning(status: StepExecutionStatus): boolean {
  return status === 'running';
}

export function isStepPending(status: StepExecutionStatus): boolean {
  return status === 'pending';
}
