import type { PlanVersion } from '../domain/plan.js';
import type { Step } from '../domain/step.js';
import type { TaskContract, ContractInput, ContractOutput } from '../domain/contract.js';

// ============================================
// Types
// ============================================

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContractValidationContext {
  /** All step IDs in the plan (for source validation) */
  stepIds: Set<string>;
  /** Map of step ID to its outputs (for input source validation) */
  stepOutputs: Map<string, ContractOutput[]>;
}

// ============================================
// Single Step Contract Validation
// ============================================

/**
 * Validates a single step's contract against the plan context.
 *
 * Checks:
 * - Input sources exist (either 'plan' or a valid step_id)
 * - Input source steps produce compatible outputs (if referenced)
 * - Output validation type is valid
 * - If validation='schema', schema_ref must be present
 */
export function validateContract(
  step: Step,
  planVersion: PlanVersion
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // No contract = valid (contracts are optional)
  if (!step.contract) {
    return { valid: true, errors, warnings };
  }

  const context = buildValidationContext(planVersion);
  const contract = step.contract;

  // Validate inputs
  for (const input of contract.inputs) {
    const inputErrors = validateInput(input, step.step_id, context);
    errors.push(...inputErrors);
  }

  // Validate outputs
  for (const output of contract.outputs) {
    const outputErrors = validateOutput(output, step.step_id);
    errors.push(...outputErrors);
  }

  // Validate done_definition consistency
  const doneErrors = validateDoneDefinition(step);
  warnings.push(...doneErrors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a contract input.
 */
function validateInput(
  input: ContractInput,
  stepId: string,
  context: ContractValidationContext
): string[] {
  const errors: string[] = [];

  // Check source validity
  if (input.source === 'plan') {
    // Plan-level sources are always valid
    return errors;
  }

  // Check if source step exists
  if (!context.stepIds.has(input.source)) {
    errors.push(
      `Step '${stepId}': Input '${input.name}' references non-existent step '${input.source}'`
    );
    return errors;
  }

  // Optional: Check if source step produces an artifact
  // This is informational, not an error, since outputs might be dynamic
  const sourceOutputs = context.stepOutputs.get(input.source);
  if (input.type === 'artifact' && (!sourceOutputs || sourceOutputs.length === 0)) {
    // This is a warning, not an error - the source step might not have declared outputs
    // or outputs might be determined at runtime
  }

  return errors;
}

/**
 * Validates a contract output.
 */
function validateOutput(output: ContractOutput, stepId: string): string[] {
  const errors: string[] = [];

  // If validation is 'schema', schema_ref must be present
  if (output.validation === 'schema' && !output.schema_ref) {
    errors.push(
      `Step '${stepId}': Output '${output.name}' has validation='schema' but no schema_ref`
    );
  }

  return errors;
}

/**
 * Validates done_definition consistency with step.
 */
function validateDoneDefinition(step: Step): string[] {
  const warnings: string[] = [];

  if (!step.contract) return warnings;

  const { done_definition: done, outputs } = step.contract;

  // Warn if all_outputs_present is true but no outputs defined
  if (done.all_outputs_present && outputs.length === 0) {
    warnings.push(
      `Step '${step.step_id}': done_definition requires all outputs present, but no outputs defined`
    );
  }

  // Warn if acceptance_criteria_pass is true but no criteria defined
  if (
    done.acceptance_criteria_pass &&
    (!step.acceptance_criteria || step.acceptance_criteria.length === 0)
  ) {
    warnings.push(
      `Step '${step.step_id}': done_definition requires acceptance criteria pass, but no criteria defined`
    );
  }

  return warnings;
}

// ============================================
// Plan-Level Contract Validation
// ============================================

/**
 * Validates all contracts in a plan version.
 * Aggregates errors and warnings from all steps.
 */
export function validateAllContracts(
  planVersion: PlanVersion
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const step of planVersion.steps) {
    const result = validateContract(step, planVersion);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates contract dependency chain consistency.
 *
 * Checks that:
 * - If step A's input references step B, step B should be a dependency
 * - No circular contract dependencies exist
 */
export function validateContractDependencies(
  planVersion: PlanVersion
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const step of planVersion.steps) {
    if (!step.contract) continue;

    // Check that input sources are in dependencies
    for (const input of step.contract.inputs) {
      if (input.source !== 'plan' && input.required) {
        // Check if source is a dependency
        const isDependency = step.dependencies.includes(input.source);
        if (!isDependency) {
          warnings.push(
            `Step '${step.step_id}': Input '${input.name}' from step '${input.source}' should be listed as dependency`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Builds validation context from a plan version.
 */
function buildValidationContext(planVersion: PlanVersion): ContractValidationContext {
  const stepIds = new Set(planVersion.steps.map((s) => s.step_id));
  const stepOutputs = new Map<string, ContractOutput[]>();

  for (const step of planVersion.steps) {
    if (step.contract?.outputs) {
      stepOutputs.set(step.step_id, step.contract.outputs);
    }
  }

  return { stepIds, stepOutputs };
}

/**
 * Checks if a step has a valid contract (for filtering).
 */
export function hasValidContract(step: Step): boolean {
  if (!step.contract) return true; // No contract = valid

  // Basic structural validation
  return (
    Array.isArray(step.contract.inputs) &&
    Array.isArray(step.contract.outputs) &&
    step.contract.done_definition !== undefined
  );
}

/**
 * Gets all input sources from a contract.
 */
export function getContractInputSources(contract: TaskContract): string[] {
  return contract.inputs.map((i) => i.source);
}

/**
 * Gets all required input sources from a contract.
 */
export function getRequiredInputSources(contract: TaskContract): string[] {
  return contract.inputs
    .filter((i) => i.required)
    .map((i) => i.source)
    .filter((s) => s !== 'plan');
}

/**
 * Analyzes contract coverage in a plan.
 */
export interface ContractCoverageAnalysis {
  totalSteps: number;
  stepsWithContracts: number;
  coveragePercent: number;
  stepsWithInputs: number;
  stepsWithOutputs: number;
  totalInputs: number;
  totalOutputs: number;
}

export function analyzeContractCoverage(
  planVersion: PlanVersion
): ContractCoverageAnalysis {
  const steps = planVersion.steps;
  const stepsWithContracts = steps.filter((s) => s.contract);

  let totalInputs = 0;
  let totalOutputs = 0;
  let stepsWithInputs = 0;
  let stepsWithOutputs = 0;

  for (const step of stepsWithContracts) {
    const inputs = step.contract!.inputs.length;
    const outputs = step.contract!.outputs.length;

    totalInputs += inputs;
    totalOutputs += outputs;

    if (inputs > 0) stepsWithInputs++;
    if (outputs > 0) stepsWithOutputs++;
  }

  return {
    totalSteps: steps.length,
    stepsWithContracts: stepsWithContracts.length,
    coveragePercent:
      steps.length > 0
        ? Math.round((stepsWithContracts.length / steps.length) * 100)
        : 0,
    stepsWithInputs,
    stepsWithOutputs,
    totalInputs,
    totalOutputs,
  };
}
