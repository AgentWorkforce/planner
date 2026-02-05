import type { PlanVersion } from '../domain/plan.js';
import type { Step } from '../domain/step.js';
import {
  DecompositionConfig,
  DEFAULT_DECOMPOSITION_CONFIG,
} from '../domain/decomposition-config.js';
import type { PlannerConfig } from '../tuner/config.js';

// ============================================
// Types
// ============================================

export interface LimitsValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface ScopeStepCount {
  scope: string;
  count: number;
  limit: number;
  exceeds: boolean;
}

export interface DepthValidationResult {
  valid: boolean;
  depth: number;
  maxDepth: number;
  path: string[];
  error?: string;
}

// ============================================
// Storage Interface (for depth validation)
// ============================================

/**
 * Minimal storage interface for depth validation.
 * Only requires the ability to fetch a plan version.
 */
export interface PlanStorage {
  getPlanVersion(planId: string, version?: number): Promise<PlanVersion | null>;
}

// ============================================
// Step Count Validation
// ============================================

/**
 * Groups steps by scope and counts them.
 */
export function groupStepsByScope(steps: Step[]): Map<string, Step[]> {
  const groups = new Map<string, Step[]>();

  for (const step of steps) {
    const scope = step.scope ?? '__default__';
    const group = groups.get(scope) ?? [];
    group.push(step);
    groups.set(scope, group);
  }

  return groups;
}

/**
 * Counts steps per scope and checks against limit.
 */
export function countStepsPerScope(
  steps: Step[],
  limit: number
): ScopeStepCount[] {
  const groups = groupStepsByScope(steps);
  const results: ScopeStepCount[] = [];

  for (const [scope, scopeSteps] of groups) {
    results.push({
      scope: scope === '__default__' ? '(no scope)' : scope,
      count: scopeSteps.length,
      limit,
      exceeds: scopeSteps.length > limit,
    });
  }

  return results;
}

/**
 * Validates step count limits for a plan version.
 *
 * Returns warnings for scopes exceeding the limit.
 * Step limit violations are soft warnings, not hard errors.
 */
export function validatePlanLimits(
  planVersion: PlanVersion,
  config?: DecompositionConfig | PlannerConfig
): LimitsValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Extract decomposition config
  const decomp = getDecompositionConfig(planVersion, config);
  const limit = decomp.max_steps_per_scope;

  // Count steps per scope
  const scopeCounts = countStepsPerScope(planVersion.steps, limit);

  // Generate warnings for exceeding scopes
  for (const scopeCount of scopeCounts) {
    if (scopeCount.exceeds) {
      warnings.push(
        `Scope '${scopeCount.scope}' has ${scopeCount.count} steps (max ${scopeCount.limit}). Consider decomposition.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// ============================================
// Sub-Plan Depth Validation
// ============================================

/**
 * Validates sub-plan depth by traversing sub_plan_id references.
 *
 * Returns error if:
 * - Depth exceeds max_depth
 * - Circular reference detected
 *
 * Requires storage access to fetch sub-plans.
 */
export async function validateSubPlanDepth(
  planId: string,
  storage: PlanStorage,
  maxDepth?: number
): Promise<DepthValidationResult> {
  const effectiveMaxDepth = maxDepth ?? DEFAULT_DECOMPOSITION_CONFIG.max_depth;
  const visited = new Set<string>();
  const path: string[] = [planId];

  let currentPlanId = planId;
  let depth = 1;

  while (depth <= effectiveMaxDepth + 1) {
    // Check for circular reference
    if (visited.has(currentPlanId)) {
      return {
        valid: false,
        depth,
        maxDepth: effectiveMaxDepth,
        path,
        error: `Circular sub-plan reference detected: ${path.join(' -> ')} -> ${currentPlanId}`,
      };
    }

    visited.add(currentPlanId);

    // Fetch the plan version
    const planVersion = await storage.getPlanVersion(currentPlanId);
    if (!planVersion) {
      // Plan doesn't exist yet or was deleted - not an error
      break;
    }

    // Check if any step has a sub_plan_id
    const subPlanIds = planVersion.steps
      .filter((s) => s.sub_plan_id)
      .map((s) => s.sub_plan_id!);

    if (subPlanIds.length === 0) {
      // No more sub-plans, we're done
      break;
    }

    // For simplicity, we follow the first sub-plan reference
    // A more comprehensive check would validate all paths
    currentPlanId = subPlanIds[0];
    path.push(currentPlanId);
    depth++;
  }

  // Check depth limit
  if (depth > effectiveMaxDepth) {
    return {
      valid: false,
      depth,
      maxDepth: effectiveMaxDepth,
      path,
      error: `Sub-plan depth exceeds maximum (${depth} > ${effectiveMaxDepth}). Path: ${path.join(' -> ')}`,
    };
  }

  return {
    valid: true,
    depth,
    maxDepth: effectiveMaxDepth,
    path,
  };
}

/**
 * Validates all sub-plan depths in a plan.
 * Checks each step with sub_plan_id.
 */
export async function validateAllSubPlanDepths(
  planVersion: PlanVersion,
  storage: PlanStorage,
  config?: DecompositionConfig | PlannerConfig
): Promise<LimitsValidationResult> {
  const decomp = getDecompositionConfig(planVersion, config);
  const warnings: string[] = [];
  const errors: string[] = [];

  // Find all steps with sub_plan_id
  const stepsWithSubPlans = planVersion.steps.filter((s) => s.sub_plan_id);

  if (stepsWithSubPlans.length === 0) {
    return { valid: true, warnings, errors };
  }

  // Check if sub-plans are allowed
  if (!decomp.allow_sub_plans) {
    errors.push('Sub-plans are not allowed in this plan configuration');
    return { valid: false, warnings, errors };
  }

  // Validate depth for each sub-plan reference
  for (const step of stepsWithSubPlans) {
    const result = await validateSubPlanDepth(
      step.sub_plan_id!,
      storage,
      decomp.max_depth
    );

    if (!result.valid) {
      errors.push(
        result.error ?? `Sub-plan depth exceeded for step '${step.step_id}'`
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// ============================================
// Combined Validation
// ============================================

/**
 * Performs full limits validation including step counts and depth.
 */
export async function validateAllLimits(
  planVersion: PlanVersion,
  storage: PlanStorage,
  config?: DecompositionConfig | PlannerConfig
): Promise<LimitsValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate step counts
  const stepLimitsResult = validatePlanLimits(planVersion, config);
  warnings.push(...stepLimitsResult.warnings);
  errors.push(...stepLimitsResult.errors);

  // Validate sub-plan depths
  const depthResult = await validateAllSubPlanDepths(planVersion, storage, config);
  warnings.push(...depthResult.warnings);
  errors.push(...depthResult.errors);

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extracts DecompositionConfig from various config sources.
 */
function getDecompositionConfig(
  planVersion: PlanVersion,
  config?: DecompositionConfig | PlannerConfig
): DecompositionConfig {
  // Priority: explicit config > planVersion config > defaults
  if (config) {
    if ('max_steps_per_scope' in config) {
      // It's a DecompositionConfig
      return config as DecompositionConfig;
    }
    if ('decomposition' in config) {
      // It's a PlannerConfig
      return {
        max_step_complexity:
          (config as PlannerConfig).decomposition?.max_steps_per_scope !== undefined
            ? 'simple'
            : DEFAULT_DECOMPOSITION_CONFIG.max_step_complexity,
        auto_decompose_threshold:
          (config as PlannerConfig).decomposition?.auto_decompose_threshold ??
          DEFAULT_DECOMPOSITION_CONFIG.auto_decompose_threshold,
        max_steps_per_scope:
          (config as PlannerConfig).decomposition?.max_steps_per_scope ??
          DEFAULT_DECOMPOSITION_CONFIG.max_steps_per_scope,
        max_depth:
          (config as PlannerConfig).decomposition?.max_depth ??
          DEFAULT_DECOMPOSITION_CONFIG.max_depth,
        allow_sub_plans: DEFAULT_DECOMPOSITION_CONFIG.allow_sub_plans,
      };
    }
  }

  // Use plan version's config or defaults
  return planVersion.decomposition_config ?? DEFAULT_DECOMPOSITION_CONFIG;
}

/**
 * Gets a summary of step distribution across scopes.
 */
export function getStepDistributionSummary(planVersion: PlanVersion): {
  totalSteps: number;
  scopeCount: number;
  scopeCounts: ScopeStepCount[];
  maxStepsInScope: number;
  averageStepsPerScope: number;
} {
  const limit = planVersion.decomposition_config?.max_steps_per_scope ?? 15;
  const scopeCounts = countStepsPerScope(planVersion.steps, limit);

  const totalSteps = planVersion.steps.length;
  const scopeCount = scopeCounts.length;
  const maxStepsInScope = Math.max(...scopeCounts.map((s) => s.count), 0);
  const averageStepsPerScope =
    scopeCount > 0 ? Math.round(totalSteps / scopeCount) : 0;

  return {
    totalSteps,
    scopeCount,
    scopeCounts,
    maxStepsInScope,
    averageStepsPerScope,
  };
}
