import {
  AttentionType,
  AttentionConfig,
  DEFAULT_ATTENTION_CONFIG,
} from './attention.js';
import type { Plan, PlanVersion } from './plan.js';
import { PlanStatus } from './status.js';

/**
 * Execution status from the orchestrator.
 * Simplified view of what we need for attention computation.
 */
export interface ExecutionStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Steps that are blocked, potentially on gates */
  blockedSteps?: Array<{
    step_id: string;
    has_gate: boolean;
  }>;
}

/**
 * Input for computing attention types.
 * All data needed to determine what attention a plan requires.
 */
export interface AttentionInput {
  plan: Plan;
  latestVersion: PlanVersion;
  pendingChangeRequests: number;
  executionStatus?: ExecutionStatus | null;
  unresolvedCommentCount: number;
}

/**
 * Computes attention types for a plan based on its current state.
 * This is a pure function with no side effects - all data is passed in.
 *
 * @param input - Plan data and related context
 * @param config - Optional configuration for thresholds
 * @returns Array of applicable attention types (can have multiple)
 */
export function computeAttentionTypes(
  input: AttentionInput,
  config: AttentionConfig = DEFAULT_ATTENTION_CONFIG
): AttentionType[] {
  const { latestVersion, pendingChangeRequests, executionStatus, unresolvedCommentCount } =
    input;
  const types: AttentionType[] = [];

  const now = new Date();
  const updatedAt = new Date(latestVersion.updated_at);

  // awaiting_approval: draft with submitted_at set
  if (latestVersion.status === PlanStatus.Draft && latestVersion.submitted_at) {
    types.push('awaiting_approval');
  }

  // change_request: has pending change requests
  if (pendingChangeRequests > 0) {
    types.push('change_request');
  }

  // gate_pending: published with blocked step that has a gate
  if (
    latestVersion.status === PlanStatus.Published &&
    executionStatus?.blockedSteps?.some((s) => s.has_gate)
  ) {
    types.push('gate_pending');
  }

  // execution_failed: published with failed execution
  if (latestVersion.status === PlanStatus.Published && executionStatus?.status === 'failed') {
    types.push('execution_failed');
  }

  // unread_comments: has unresolved comments
  if (unresolvedCommentCount > 0) {
    types.push('unread_comments');
  }

  // stale_draft: draft not updated in threshold days
  const staleDaysMs = config.stale_draft_threshold_days * 24 * 60 * 60 * 1000;
  if (
    latestVersion.status === PlanStatus.Draft &&
    !latestVersion.submitted_at &&
    now.getTime() - updatedAt.getTime() > staleDaysMs
  ) {
    types.push('stale_draft');
  }

  // active: draft updated recently OR published with running execution
  const activeHoursMs = config.active_threshold_hours * 60 * 60 * 1000;
  const isRecentlyUpdated = now.getTime() - updatedAt.getTime() < activeHoursMs;
  const isRunning =
    latestVersion.status === PlanStatus.Published && executionStatus?.status === 'running';

  if (
    (latestVersion.status === PlanStatus.Draft && isRecentlyUpdated) ||
    isRunning
  ) {
    types.push('active');
  }

  // none: no signals
  if (types.length === 0) {
    types.push('none');
  }

  return types;
}
