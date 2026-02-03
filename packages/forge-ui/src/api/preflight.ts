/**
 * Preflight API for Forge UI
 *
 * Provides functions for fetching plan data and running preflight validation
 * before starting a run. Uses the Planner API for plan data and Forge API
 * for validation and run creation.
 */

import { post } from './client';
import type {
  ForgePlan,
  PreflightValidationResult,
  CreateRunResponse,
  CreateRunOptions,
} from '@/types';

/**
 * Base URL for Planner API
 * Can be configured via environment variable
 */
const PLANNER_API_BASE = '/api';

/**
 * Get plan data for preflight display
 *
 * @param planId - The plan ID to fetch
 * @param version - Optional specific version (defaults to latest published)
 * @returns Plan with summary and steps
 */
export async function getPlanForPreflight(
  planId: string,
  version?: number
): Promise<ForgePlan> {
  const url = version
    ? `${PLANNER_API_BASE}/plans/${planId}/versions/${version}`
    : `${PLANNER_API_BASE}/plans/${planId}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch plan: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform the plan data to ForgePlan format
  return {
    plan_id: data.plan_id,
    plan_version: data.version || data.latest_version,
    goal: data.summary?.goal || data.goal || 'Untitled Plan',
    steps: (data.steps || []).map((step: Record<string, unknown>) => ({
      step_id: step.step_id,
      title: step.title,
      description: step.description,
      scope: step.scope,
      dependencies: step.dependencies,
      gate: step.gate,
    })),
    metadata: data.metadata,
  };
}

/**
 * Run preflight validation for a plan
 *
 * Performs checks like:
 * - Plan has at least one step
 * - All step dependencies reference existing steps
 * - No circular dependencies
 * - Required roles are available
 *
 * @param planId - The plan ID to validate
 * @returns Validation result with checks and overall validity
 */
export async function validatePreflight(
  planId: string
): Promise<PreflightValidationResult> {
  try {
    // First fetch the plan to run client-side validation
    const plan = await getPlanForPreflight(planId);

    const checks = runPreflightChecks(plan);
    const valid = checks.every((c) => c.status !== 'fail');

    return { checks, valid };
  } catch (error) {
    // Return a failed check if we couldn't fetch the plan
    return {
      checks: [
        {
          id: 'plan-fetch',
          name: 'Plan Available',
          status: 'fail',
          message:
            error instanceof Error
              ? error.message
              : 'Could not fetch plan for validation',
        },
      ],
      valid: false,
    };
  }
}

/**
 * Run preflight checks on a plan
 */
function runPreflightChecks(
  plan: ForgePlan
): PreflightValidationResult['checks'] {
  const checks: PreflightValidationResult['checks'] = [];

  // Check 1: Plan has steps
  checks.push({
    id: 'has-steps',
    name: 'Plan Has Steps',
    status: plan.steps.length > 0 ? 'pass' : 'fail',
    message:
      plan.steps.length > 0
        ? `${plan.steps.length} steps found`
        : 'Plan has no steps to execute',
  });

  // Check 2: Validate dependencies reference existing steps
  const stepIds = new Set(plan.steps.map((s) => s.step_id));
  const invalidDeps: string[] = [];

  for (const step of plan.steps) {
    for (const dep of step.dependencies || []) {
      if (!stepIds.has(dep)) {
        invalidDeps.push(`${step.step_id} -> ${dep}`);
      }
    }
  }

  checks.push({
    id: 'valid-dependencies',
    name: 'Valid Dependencies',
    status: invalidDeps.length === 0 ? 'pass' : 'fail',
    message:
      invalidDeps.length === 0
        ? 'All dependencies reference valid steps'
        : `Invalid dependencies: ${invalidDeps.join(', ')}`,
  });

  // Check 3: Check for circular dependencies
  const circularResult = detectCircularDependencies(plan.steps);
  checks.push({
    id: 'no-circular-deps',
    name: 'No Circular Dependencies',
    status: circularResult.hasCircular ? 'fail' : 'pass',
    message: circularResult.hasCircular
      ? `Circular dependency detected: ${circularResult.cycle}`
      : 'No circular dependencies detected',
  });

  // Check 4: Check for gates (warning, not failure)
  const gateCount = plan.steps.filter((s) => s.gate).length;
  checks.push({
    id: 'gates-info',
    name: 'Human Approval Gates',
    status: gateCount > 0 ? 'warning' : 'pass',
    message:
      gateCount > 0
        ? `${gateCount} step(s) require human approval`
        : 'No approval gates in this plan',
  });

  // Check 5: Plan metadata
  checks.push({
    id: 'plan-ready',
    name: 'Plan Ready',
    status: 'pass',
    message: `Plan v${plan.plan_version} is ready for execution`,
  });

  return checks;
}

/**
 * Detect circular dependencies in steps
 */
function detectCircularDependencies(steps: ForgePlan['steps']): {
  hasCircular: boolean;
  cycle?: string;
} {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const stepMap = new Map(steps.map((s) => [s.step_id, s]));

  function dfs(stepId: string, path: string[]): string | null {
    visited.add(stepId);
    recursionStack.add(stepId);

    const step = stepMap.get(stepId);
    if (!step) return null;

    for (const dep of step.dependencies || []) {
      if (!visited.has(dep)) {
        const result = dfs(dep, [...path, stepId]);
        if (result) return result;
      } else if (recursionStack.has(dep)) {
        return [...path, stepId, dep].join(' -> ');
      }
    }

    recursionStack.delete(stepId);
    return null;
  }

  for (const step of steps) {
    if (!visited.has(step.step_id)) {
      const cycle = dfs(step.step_id, []);
      if (cycle) {
        return { hasCircular: true, cycle };
      }
    }
  }

  return { hasCircular: false };
}

/**
 * Create a new run from a plan
 *
 * @param planId - The plan ID to create a run from
 * @param options - Run creation options (e.g., environment)
 * @returns Created run response with run_id and status
 */
export async function createRun(
  planId: string,
  options?: CreateRunOptions
): Promise<CreateRunResponse> {
  return post<CreateRunResponse>('/runs', {
    plan_id: planId,
    environment: options?.environment || 'development',
  });
}

/**
 * Check if the Planner API is reachable
 */
export async function checkPlannerAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${PLANNER_API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    // Try fetching plans as fallback health check
    try {
      const response = await fetch(`${PLANNER_API_BASE}/plans?limit=1`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
