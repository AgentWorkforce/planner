/**
 * Planner Client
 *
 * HTTP client for calling planner-core API.
 */

import type { PlannerClient } from './handlers.js';

// =============================================================================
// HTTP Planner Client
// =============================================================================

export interface HttpPlannerClientConfig {
  baseUrl: string;
}

export function createHttpPlannerClient(config: HttpPlannerClientConfig): PlannerClient {
  const { baseUrl } = config;

  return {
    async createPlan(params) {
      const response = await fetch(`${baseUrl}/api/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: params.goal,
          context: params.context,
          source: params.source,
          understanding: params.understanding,
          initiative_id: params.initiative_id,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Planner API error: ${response.status} ${error}`);
      }

      const data = await response.json() as {
        plan: { plan_id: string };
        version: { version: number };
      };
      return {
        plan_id: data.plan.plan_id,
        version: data.version.version,
      };
    },
  };
}

// =============================================================================
// Mock Planner Client (for testing)
// =============================================================================

export function createMockPlannerClient(): PlannerClient {
  return {
    async createPlan(_params) {
      return {
        plan_id: `plan-${Date.now()}`,
        version: 1,
      };
    },
  };
}
