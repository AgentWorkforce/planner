/**
 * Runs API for Forge UI
 *
 * Provides functions for interacting with run resources.
 */

import { get, post } from './client';
import type { Run, RunListResponse, RunFilter } from '@/types';

/**
 * List runs with optional filtering
 */
export async function listRuns(filter?: RunFilter): Promise<RunListResponse> {
  const params: Record<string, unknown> = {};

  if (filter?.status) {
    params.status = filter.status;
  }
  if (filter?.plan_id) {
    params.plan_id = filter.plan_id;
  }
  if (filter?.limit !== undefined) {
    params.limit = filter.limit;
  }
  if (filter?.offset !== undefined) {
    params.offset = filter.offset;
  }

  return get<RunListResponse>('/runs', params);
}

/**
 * Get a single run by ID
 */
export async function getRun(runId: string): Promise<Run> {
  return get<Run>(`/runs/${runId}`);
}

/**
 * Pause a running run
 */
export async function pauseRun(runId: string): Promise<Run> {
  return post<Run>(`/runs/${runId}/pause`);
}

/**
 * Resume a paused run
 */
export async function resumeRun(runId: string): Promise<Run> {
  return post<Run>(`/runs/${runId}/resume`);
}

/**
 * Cancel a run
 */
export async function cancelRun(runId: string): Promise<Run> {
  return post<Run>(`/runs/${runId}/cancel`);
}

/**
 * Retry failed tasks in a run
 */
export async function retryRun(runId: string): Promise<Run> {
  return post<Run>(`/runs/${runId}/retry`);
}
