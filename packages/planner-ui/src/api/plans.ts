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

export async function listPlans(status?: PlanStatus): Promise<{ plans: PlanSummary[] }> {
  const query = status ? `?status=${status}` : '';
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
  data: { goal?: string; context?: string; steps?: Step[] }
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
