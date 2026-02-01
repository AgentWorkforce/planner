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

    async createVersion(params) {
      const response = await fetch(`${baseUrl}/api/plans/${params.plan_id}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: params.goal,
          context: params.context,
          understanding: params.understanding,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Planner API error: ${response.status} ${error}`);
      }

      const data = await response.json() as {
        version: number;
      };
      return {
        plan_id: params.plan_id,
        version: data.version,
      };
    },

    async updatePlan(params) {
      const response = await fetch(`${baseUrl}/api/plans/${params.plan_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          understanding: params.understanding,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Planner API error: ${response.status} ${error}`);
      }
    },
  };
}

// =============================================================================
// Mock Planner Client (for testing)
// =============================================================================

let mockVersionCounter = 1;

export function createMockPlannerClient(): PlannerClient {
  return {
    async createPlan(_params) {
      mockVersionCounter = 1;
      return {
        plan_id: `plan-${Date.now()}`,
        version: mockVersionCounter,
      };
    },

    async createVersion(params) {
      mockVersionCounter++;
      return {
        plan_id: params.plan_id,
        version: mockVersionCounter,
      };
    },

    async updatePlan(_params) {
      // Mock - no-op
    },
  };
}
