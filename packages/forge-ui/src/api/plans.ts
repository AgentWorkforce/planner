/**
 * Plans API for Forge UI
 *
 * Provides functions for fetching plans from the Planner API.
 * Used for importing published plans into Forge.
 */

// Note: Using fetch directly since the Planner API is at /api, not /forge-api

/**
 * Published plan summary from Planner API
 */
export interface PublishedPlanSummary {
  plan_id: string;
  goal: string;
  status: string;
  latest_version: number;
  scopes?: string[];
  updated_at: string;
  created_at: string;
}

interface PlansListResponse {
  plans: PublishedPlanSummary[];
  total: number;
}

/**
 * List published plans available for import
 *
 * Note: This calls the Planner API (proxied through /api) not the Forge API.
 */
export async function listPublishedPlans(): Promise<PlansListResponse> {
  // The Planner API is available at /api, not /forge-api
  const response = await fetch('/api/plans?status=published&limit=100');

  if (!response.ok) {
    throw new Error('Failed to fetch published plans');
  }

  return response.json();
}

/**
 * Get a specific plan by ID
 */
export async function getPlan(planId: string): Promise<PublishedPlanSummary> {
  const response = await fetch(`/api/plans/${planId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch plan');
  }

  return response.json();
}
