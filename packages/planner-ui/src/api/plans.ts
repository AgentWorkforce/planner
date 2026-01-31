import { get, post, put } from './client';
import type {
  Plan,
  PlanVersion,
  PlanWithVersion,
  PlanSummary,
  PlanStatus,
  Step,
} from '@/types';

// Plan operations

export interface ListPlansParams {
  status?: PlanStatus;
  initiative_id?: string;
  owner_user_id?: string;
  include_attention?: boolean;
}

export async function listPlans(
  params?: ListPlansParams
): Promise<{ plans: PlanSummary[] }> {
  const searchParams = new URLSearchParams();

  if (params) {
    if (params.status) searchParams.set('status', params.status);
    if (params.initiative_id) searchParams.set('initiative_id', params.initiative_id);
    if (params.owner_user_id) searchParams.set('owner_user_id', params.owner_user_id);
    if (params.include_attention !== false) searchParams.set('include_attention', 'true');
  } else {
    // Default: include attention types
    searchParams.set('include_attention', 'true');
  }

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return get<{ plans: PlanSummary[] }>(`/plans${query}`);
}

export async function getPlan(planId: string): Promise<PlanWithVersion> {
  return get<PlanWithVersion>(`/plans/${planId}`);
}

export async function createPlan(goal: string, context?: string): Promise<PlanWithVersion> {
  return post<PlanWithVersion>('/plans', { goal, context });
}

export async function updatePlan(
  planId: string,
  data: { goal?: string; context?: string; steps?: Step[]; initiative_id?: string | null }
): Promise<PlanWithVersion> {
  return put<PlanWithVersion>(`/plans/${planId}`, data);
}

// Version operations

export async function listVersions(planId: string): Promise<{ versions: PlanVersion[] }> {
  return get<{ versions: PlanVersion[] }>(`/plans/${planId}/versions`);
}

export async function getVersion(
  planId: string,
  version: number
): Promise<{ plan: Plan; version: PlanVersion }> {
  return get<{ plan: Plan; version: PlanVersion }>(`/plans/${planId}/versions/${version}`);
}

export async function createVersion(
  planId: string,
  data?: { goal?: string; context?: string }
): Promise<PlanWithVersion> {
  return post<PlanWithVersion>(`/plans/${planId}/versions`, data);
}

// Workflow operations

export async function submitVersion(
  planId: string,
  version: number
): Promise<{ version: PlanVersion }> {
  return post<{ version: PlanVersion }>(`/plans/${planId}/versions/${version}/submit`);
}

export async function approveVersion(
  planId: string,
  version: number,
  approver: string
): Promise<{ version: PlanVersion }> {
  return post<{ version: PlanVersion }>(`/plans/${planId}/versions/${version}/approve`, {
    approver,
  });
}

export async function publishVersion(
  planId: string,
  version: number
): Promise<{ version: PlanVersion; plan_ref: string }> {
  return post<{ version: PlanVersion; plan_ref: string }>(
    `/plans/${planId}/versions/${version}/publish`
  );
}
