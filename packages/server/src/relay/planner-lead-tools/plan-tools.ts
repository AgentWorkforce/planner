/**
 * Plan reading and listing tools for PlannerLead.
 */

import type { PlanStorage } from '../../../../planner/src/storage/interface.js';
import type { Step } from '../../../../planner/src/domain/step.js';
import type { ToolResult } from './types.js';

/**
 * Find a plan by ID or ID prefix.
 * Channel names only contain 8 characters of the UUID (e.g., #plan-042265be),
 * so we need to resolve the prefix to the full plan ID.
 */
export function findPlanByIdPrefix(storage: PlanStorage, idPrefix: string) {
  // If it looks like a full UUID, try direct lookup first
  if (idPrefix.length >= 32) {
    return storage.getPlan(idPrefix);
  }

  // Search by prefix
  const plans = storage.listPlans();
  const match = plans.find((p) => p.plan_id.startsWith(idPrefix));
  return match || null;
}

/**
 * Execute read_plan tool.
 */
export async function executeReadPlan(
  input: { plan_id: string },
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Support partial IDs from channel names (e.g., "042265be" from "#plan-042265be")
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    const version = storage.getLatestVersion(plan.plan_id);
    if (!version) {
      return { success: false, error: `No version found for plan: ${plan.plan_id}` };
    }

    return {
      success: true,
      result: {
        plan_id: plan.plan_id,
        goal: version.summary.goal,
        context: version.summary.context,
        status: version.status,
        version: version.version,
        step_count: version.steps.length,
        steps: version.steps.map((s: Step) => ({
          step_id: s.step_id,
          title: s.title,
          description: s.description,
          scope: s.scope,
          dependencies: s.dependencies,
          owner_role: s.owner_role,
        })),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute list_plans tool.
 */
export async function executeListPlans(
  input: { status?: string },
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    const plans = storage.listPlans();

    const filtered = input.status
      ? plans.filter((p) => {
          const version = storage.getLatestVersion(p.plan_id);
          return version?.status === input.status;
        })
      : plans;

    return {
      success: true,
      result: filtered.map((p) => {
        const version = storage.getLatestVersion(p.plan_id);
        return {
          plan_id: p.plan_id,
          goal: version?.summary.goal || 'No goal',
          status: version?.status || 'unknown',
          step_count: version?.steps.length || 0,
        };
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
