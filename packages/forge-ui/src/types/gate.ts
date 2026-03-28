/**
 * Gate types for the Forge orchestration UI
 * Gates are approval checkpoints that require human sign-off
 */

export enum GateStatus {
  PENDING = 'pending',
  WAITING = 'waiting',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

export interface GateArtifact {
  artifact_id: string;
  type: 'pr' | 'commit' | 'test' | 'file' | 'link' | 'other';
  label: string;
  url: string;
  status?: 'open' | 'merged' | 'closed' | 'passed' | 'failed';
}

export interface Gate {
  gate_id: string;
  run_id: string;
  task_id: string;
  step_id: string;

  status: GateStatus;
  gate_type: 'human_approval' | 'automated_check';

  // Gate configuration
  title: string;
  description?: string;
  approver_role?: string;

  // Resolution
  resolved_by?: string;
  resolved_at?: string;
  resolution_comment?: string;

  // Context
  blocked_tasks: string[];
  context?: GateContext;

  // Artifacts for review
  artifacts?: GateArtifact[];

  created_at: string;
  updated_at: string;
}

export interface GateContext {
  task_output?: string;
  artifacts?: string[];
  acceptance_criteria?: AcceptanceCriterion[];
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
  verified?: boolean;
  verified_by?: string;
  verified_at?: string;
}

export interface GateSummary {
  gate_id: string;
  task_id: string;
  title: string;
  status: GateStatus;
  gate_type: 'human_approval' | 'automated_check';
  blocked_tasks_count: number;
  created_at: string;
}

/**
 * Response types for gate API
 */
export interface PendingGatesResponse {
  gates: Gate[];
  total: number;
}

export interface GateApprovalRequest {
  comment?: string;
}

export interface GateRejectionRequest {
  reason: string;
}
