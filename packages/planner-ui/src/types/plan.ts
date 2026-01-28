export type PlanStatus = 'draft' | 'approved' | 'published';

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

export interface Plan {
  plan_id: string;
  created_at: string;
  updated_at: string;
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

export interface PlanWithVersion {
  plan: Plan;
  version: PlanVersion;
}

export interface PlanSummary {
  plan_id: string;
  goal: string;
  status: PlanStatus;
  latest_version: number;
  created_at: string;
  updated_at: string;
}
