import type { PlanVersion } from '../../domain/plan.js';
import type { DecompositionConfig } from '../../domain/decomposition-config.js';
import type { PlannerConfig } from '../../tuner/config.js';
import { DEFAULT_PLANNER_CONFIG, getDefaultTunerClient } from '../../tuner/index.js';
import {
  validatePlanLimits,
  validateAllSubPlanDepths,
  validateAllContracts,
  validateContractDependencies,
  type LimitsEnforcerPlanStorage as PlanStorage,
  type LimitsValidationResult,
  type ContractValidationResult,
} from '../../services/index.js';

// ============================================
// Types
// ============================================

export interface DOTValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  details: {
    limits?: LimitsValidationResult;
    contracts?: ContractValidationResult;
    dependencies?: ContractValidationResult;
  };
}

export interface DOTValidationOptions {
  /** Skip step count limit validation */
  skipLimits?: boolean;
  /** Skip sub-plan depth validation (requires storage) */
  skipDepthValidation?: boolean;
  /** Skip contract validation */
  skipContracts?: boolean;
  /** Skip contract dependency consistency check */
  skipDependencyCheck?: boolean;
  /** Config to use (fetches from TunerClient if not provided) */
  config?: PlannerConfig | DecompositionConfig;
  /** Storage for depth validation (required if not skipping) */
  storage?: PlanStorage;
}

// ============================================
// Main Validation Function
// ============================================

/**
 * Validates a plan version against DOT constraints.
 *
 * Checks:
 * - Step count limits per scope (soft warning)
 * - Sub-plan depth limits (hard error)
 * - Contract validity (hard error)
 * - Contract dependency consistency (soft warning)
 */
export async function validatePlanDOT(
  planVersion: PlanVersion,
  options: DOTValidationOptions = {}
): Promise<DOTValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const details: DOTValidationResult['details'] = {};

  const config = options.config ?? getConfig();

  // Validate step count limits
  if (!options.skipLimits) {
    const limitsResult = validatePlanLimits(planVersion, config);
    details.limits = limitsResult;
    warnings.push(...limitsResult.warnings);
    errors.push(...limitsResult.errors);
  }

  // Validate sub-plan depth
  if (!options.skipDepthValidation && options.storage) {
    // Check if any steps have sub_plan_id
    const hasSubPlans = planVersion.steps.some((s) => s.sub_plan_id);

    if (hasSubPlans) {
      const depthResult = await validateAllSubPlanDepths(
        planVersion,
        options.storage,
        config
      );
      warnings.push(...depthResult.warnings);
      errors.push(...depthResult.errors);
    }
  }

  // Validate contracts
  if (!options.skipContracts) {
    const contractsResult = validateAllContracts(planVersion);
    details.contracts = contractsResult;
    warnings.push(...contractsResult.warnings);
    errors.push(...contractsResult.errors);
  }

  // Validate contract dependencies
  if (!options.skipDependencyCheck) {
    const depsResult = validateContractDependencies(planVersion);
    details.dependencies = depsResult;
    warnings.push(...depsResult.warnings);
    // Contract dependency issues are warnings, not errors
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    details,
  };
}

/**
 * Synchronous validation (skips depth validation).
 */
export function validatePlanDOTSync(
  planVersion: PlanVersion,
  options: DOTValidationOptions = {}
): DOTValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const details: DOTValidationResult['details'] = {};

  const config = options.config ?? getConfig();

  // Validate step count limits
  if (!options.skipLimits) {
    const limitsResult = validatePlanLimits(planVersion, config);
    details.limits = limitsResult;
    warnings.push(...limitsResult.warnings);
    errors.push(...limitsResult.errors);
  }

  // Validate contracts
  if (!options.skipContracts) {
    const contractsResult = validateAllContracts(planVersion);
    details.contracts = contractsResult;
    warnings.push(...contractsResult.warnings);
    errors.push(...contractsResult.errors);
  }

  // Validate contract dependencies
  if (!options.skipDependencyCheck) {
    const depsResult = validateContractDependencies(planVersion);
    details.dependencies = depsResult;
    warnings.push(...depsResult.warnings);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    details,
  };
}

// ============================================
// Express Middleware
// ============================================

/**
 * Express middleware factory for DOT validation.
 *
 * Validates plan data in request body before proceeding.
 * Adds validation result to request object.
 *
 * Usage:
 * ```
 * app.post('/api/plans', dotValidationMiddleware({ storage }), createPlan);
 * ```
 */
export function createValidationMiddleware(options: DOTValidationOptions = {}) {
  return async (req: any, res: any, next: any) => {
    // Extract plan version from request body
    const planVersion = req.body as PlanVersion;

    if (!planVersion || !planVersion.steps) {
      // No plan data to validate
      next();
      return;
    }

    try {
      const result = await validatePlanDOT(planVersion, options);

      // Store validation result in request
      req.dotValidation = result;

      // If validation failed, return 400
      if (!result.valid) {
        res.status(400).json({
          error: 'DOT validation failed',
          details: result.errors,
          warnings: result.warnings,
        });
        return;
      }

      // If there are warnings, add them to response headers
      if (result.warnings.length > 0) {
        res.set('X-DOT-Warnings', result.warnings.join('; '));
      }

      next();
    } catch (error) {
      console.error('[DOT Validation] Error:', error);
      next(error);
    }
  };
}

// ============================================
// Response Helpers
// ============================================

/**
 * Formats validation result for API response.
 */
export function formatValidationResponse(result: DOTValidationResult): {
  validation: {
    valid: boolean;
    warnings?: string[];
    errors?: string[];
  };
} {
  return {
    validation: {
      valid: result.valid,
      ...(result.warnings.length > 0 && { warnings: result.warnings }),
      ...(result.errors.length > 0 && { errors: result.errors }),
    },
  };
}

/**
 * Merges validation result into an existing response.
 */
export function mergeValidationIntoResponse<T extends object>(
  data: T,
  result: DOTValidationResult
): T & { warnings?: string[] } {
  if (result.warnings.length === 0) {
    return data;
  }

  return {
    ...data,
    warnings: result.warnings,
  };
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Quick check if a plan version needs validation.
 */
export function needsValidation(planVersion: PlanVersion): boolean {
  // Always validate if:
  // - There are steps with sub_plan_id (depth check needed)
  // - There are steps with contracts
  // - There are many steps (limit check worthwhile)

  if (planVersion.steps.length === 0) return false;
  if (planVersion.steps.length > 10) return true;
  if (planVersion.steps.some((s) => s.sub_plan_id)) return true;
  if (planVersion.steps.some((s) => s.contract)) return true;

  return false;
}

/**
 * Returns a summary of what would be validated.
 */
export function getValidationSummary(planVersion: PlanVersion): {
  totalSteps: number;
  stepsWithSubPlans: number;
  stepsWithContracts: number;
  scopeCount: number;
} {
  const scopes = new Set(planVersion.steps.map((s) => s.scope ?? '__default__'));

  return {
    totalSteps: planVersion.steps.length,
    stepsWithSubPlans: planVersion.steps.filter((s) => s.sub_plan_id).length,
    stepsWithContracts: planVersion.steps.filter((s) => s.contract).length,
    scopeCount: scopes.size,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Gets the current Planner config from TunerClient.
 */
function getConfig(): PlannerConfig {
  try {
    return getDefaultTunerClient().getConfig();
  } catch {
    // Fallback to defaults if TunerClient not initialized
    return DEFAULT_PLANNER_CONFIG;
  }
}
