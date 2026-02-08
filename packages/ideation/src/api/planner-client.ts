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
          ...(params.steps && { steps: params.steps }),
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
          ...(params.steps && { steps: params.steps }),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Planner API error: ${response.status} ${error}`);
      }

      const data = await response.json() as {
        version: { version: number };
      };
      return {
        plan_id: params.plan_id,
        version: data.version.version,
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

    async linkProjectPlan(params) {
      try {
        // Find project by session_id
        const listResponse = await fetch(
          `${baseUrl}/api/projects?session_id=${encodeURIComponent(params.session_id)}`,
        );

        if (!listResponse.ok) {
          console.warn(`[PlannerClient] Failed to list projects for session ${params.session_id}: ${listResponse.status}`);
          return;
        }

        const listData = await listResponse.json() as { projects: Array<{ id: string }> };
        const project = listData.projects[0];

        if (!project) {
          console.warn(`[PlannerClient] No project found for session ${params.session_id}`);
          return;
        }

        // Update project with plan_id
        const updateResponse = await fetch(`${baseUrl}/api/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: params.plan_id }),
        });

        if (!updateResponse.ok) {
          console.warn(`[PlannerClient] Failed to link project ${project.id} to plan ${params.plan_id}: ${updateResponse.status}`);
          return;
        }

        console.log(`[PlannerClient] Linked project ${project.id} to plan ${params.plan_id}`);
      } catch (error) {
        console.warn('[PlannerClient] Error linking project to plan:', error);
      }
    },
  };
}

// =============================================================================
// Mock Planner Client (for testing)
// =============================================================================

/**
 * Creates a mock planner client for testing.
 * Each client instance tracks version counters per-plan to avoid cross-contamination.
 */
export function createMockPlannerClient(): PlannerClient {
  // Per-plan version counters to avoid shared state issues
  const versionCounters = new Map<string, number>();

  return {
    async createPlan(_params) {
      const planId = `plan-${Date.now()}`;
      versionCounters.set(planId, 1);
      return {
        plan_id: planId,
        version: 1,
      };
    },

    async createVersion(params) {
      const currentVersion = versionCounters.get(params.plan_id) ?? 0;
      const newVersion = currentVersion + 1;
      versionCounters.set(params.plan_id, newVersion);
      return {
        plan_id: params.plan_id,
        version: newVersion,
      };
    },

    async updatePlan(_params) {
      // Mock - no-op
    },

    async linkProjectPlan(_params) {
      // Mock - no-op
    },
  };
}
