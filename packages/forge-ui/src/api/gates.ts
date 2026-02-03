/**
 * Gates API for Forge UI
 *
 * Provides functions for interacting with gate resources,
 * including fetching pending gates and approving/rejecting them.
 */

import { get, post } from './client';
import type {
  Gate,
  PendingGatesResponse,
  GateApprovalRequest,
  GateRejectionRequest,
} from '@/types';

/**
 * Get all pending gates, optionally filtered by run ID
 */
export async function getPendingGates(runId?: string): Promise<PendingGatesResponse> {
  const params: Record<string, unknown> = {};
  if (runId) {
    params.run_id = runId;
  }
  return get<PendingGatesResponse>('/gates/pending', params);
}

/**
 * Get a single gate by task ID with full context
 */
export async function getGate(taskId: string): Promise<Gate> {
  return get<Gate>(`/gates/${taskId}`);
}

/**
 * Approve a gate
 */
export async function approveGate(
  taskId: string,
  comment?: string
): Promise<Gate> {
  const body: GateApprovalRequest = {};
  if (comment) {
    body.comment = comment;
  }
  return post<Gate>(`/gates/${taskId}/approve`, body);
}

/**
 * Reject a gate with a required reason
 */
export async function rejectGate(
  taskId: string,
  reason: string
): Promise<Gate> {
  const body: GateRejectionRequest = { reason };
  return post<Gate>(`/gates/${taskId}/reject`, body);
}
