import { describe, it, expect } from 'vitest';
import { createStep } from '../domain/step.js';
import { createPlanVersion } from '../domain/plan.js';
import type { PlanVersion } from '../domain/plan.js';
import type { Step } from '../domain/step.js';
import {
  createTaskContract,
  createContractInput,
  createContractOutput,
  createDoneDefinition,
} from '../domain/contract.js';
import {
  validateContract,
  validateAllContracts,
  validateContractDependencies,
  hasValidContract,
  getContractInputSources,
  getRequiredInputSources,
  analyzeContractCoverage,
} from './contract-validator.js';

// ============================================
// Helpers
// ============================================

const PLAN_ID = '123e4567-e89b-12d3-a456-426614174000';

function makePlanVersion(steps: Step[]): PlanVersion {
  const pv = createPlanVersion(PLAN_ID, 'Test goal');
  return { ...pv, steps } as PlanVersion;
}

function makeStepWithContract(
  title: string,
  options: {
    step_id?: string;
    scope?: string;
    description?: string;
    dependencies?: string[];
    inputs?: Parameters<typeof createContractInput>[0][];
    outputs?: Parameters<typeof createContractOutput>[0][];
    doneDefinition?: Parameters<typeof createDoneDefinition>[0];
    acceptance_criteria?: { id: string; description: string }[];
  } = {}
): Step {
  const contract = createTaskContract({
    inputs: options.inputs?.map(createContractInput) ?? [],
    outputs: options.outputs?.map(createContractOutput) ?? [],
    doneDefinition: options.doneDefinition ? createDoneDefinition(options.doneDefinition) : undefined,
  });

  const step = createStep(title, {
    scope: options.scope,
    description: options.description,
    dependencies: options.dependencies,
    contract,
    acceptance_criteria: options.acceptance_criteria,
  });

  // Override step_id if provided (for stable references)
  if (options.step_id) {
    return { ...step, step_id: options.step_id } as Step;
  }
  return step;
}

// ============================================
// validateContract
// ============================================

describe('validateContract', () => {
  it('should return valid for step without contract', () => {
    const step = createStep('No contract', { description: 'plain step' });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should return valid for contract with plan source', () => {
    const step = makeStepWithContract('With plan input', {
      inputs: [{ name: 'config', type: 'context', source: 'plan', required: true }],
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.valid).toBe(true);
  });

  it('should return valid for contract referencing existing step', () => {
    const stepA = createStep('Producer', { description: 'produces output' });
    const step_id_a = stepA.step_id;
    const stepB = makeStepWithContract('Consumer', {
      inputs: [{ name: 'data', type: 'artifact', source: step_id_a, required: true }],
      dependencies: [step_id_a],
    });
    const pv = makePlanVersion([stepA, stepB]);
    const result = validateContract(stepB, pv);
    expect(result.valid).toBe(true);
  });

  it('should error for contract referencing non-existent step', () => {
    const step = makeStepWithContract('Bad ref', {
      inputs: [{ name: 'data', type: 'artifact', source: 'non-existent-step', required: true }],
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('non-existent step');
  });

  it('should error for output with schema validation but no schema_ref', () => {
    const step = makeStepWithContract('Schema output', {
      outputs: [{ name: 'api-spec', type: 'schema', validation: 'schema' }],
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("validation='schema'");
    expect(result.errors[0]).toContain('no schema_ref');
  });

  it('should pass for output with schema validation and schema_ref', () => {
    const step = makeStepWithContract('Schema output', {
      outputs: [{ name: 'api-spec', type: 'schema', validation: 'schema', schemaRef: 'openapi.yaml' }],
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.valid).toBe(true);
  });

  it('should warn when done_definition requires outputs but none defined', () => {
    const step = makeStepWithContract('Bad done', {
      doneDefinition: { allOutputsPresent: true, acceptanceCriteriaPass: false },
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    // This is a warning, not an error
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('all outputs present');
    expect(result.warnings[0]).toContain('no outputs defined');
  });

  it('should warn when done_definition requires acceptance criteria but none defined', () => {
    const step = makeStepWithContract('Bad done', {
      doneDefinition: { allOutputsPresent: false, acceptanceCriteriaPass: true },
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('acceptance criteria');
  });

  it('should not warn when done_definition requires criteria and criteria are defined', () => {
    const step = makeStepWithContract('Good done', {
      doneDefinition: { acceptanceCriteriaPass: true },
      acceptance_criteria: [{ id: 'ac-1', description: 'Works correctly' }],
    });
    const pv = makePlanVersion([step]);
    const result = validateContract(step, pv);
    expect(result.warnings.filter((w) => w.includes('acceptance criteria'))).toEqual([]);
  });
});

// ============================================
// validateAllContracts
// ============================================

describe('validateAllContracts', () => {
  it('should validate all steps in a plan', () => {
    const stepA = createStep('Plain', { description: 'no contract' });
    const stepB = makeStepWithContract('Bad ref', {
      inputs: [{ name: 'data', type: 'artifact', source: 'ghost-step', required: true }],
    });
    const pv = makePlanVersion([stepA, stepB]);
    const result = validateAllContracts(pv);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('should aggregate warnings from multiple steps', () => {
    const step1 = makeStepWithContract('S1', {
      doneDefinition: { allOutputsPresent: true, acceptanceCriteriaPass: false },
    });
    const step2 = makeStepWithContract('S2', {
      doneDefinition: { allOutputsPresent: false, acceptanceCriteriaPass: true },
    });
    const pv = makePlanVersion([step1, step2]);
    const result = validateAllContracts(pv);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(2);
  });

  it('should return valid for plan with no contracts', () => {
    const steps = [
      createStep('A', { description: 'no contract' }),
      createStep('B', { description: 'no contract' }),
    ];
    const pv = makePlanVersion(steps);
    const result = validateAllContracts(pv);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

// ============================================
// validateContractDependencies
// ============================================

describe('validateContractDependencies', () => {
  it('should warn when required input source is not a dependency', () => {
    const stepA = createStep('Producer', { description: 'outputs stuff' });
    const stepB = makeStepWithContract('Consumer', {
      // References stepA as input source but does NOT list it as dependency
      inputs: [{ name: 'data', type: 'artifact', source: stepA.step_id, required: true }],
      dependencies: [], // missing stepA.step_id
    });
    const pv = makePlanVersion([stepA, stepB]);
    const result = validateContractDependencies(pv);
    expect(result.valid).toBe(true); // warnings only
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('should be listed as dependency');
  });

  it('should not warn when required input source is a dependency', () => {
    const stepA = createStep('Producer', { description: 'outputs stuff' });
    const stepB = makeStepWithContract('Consumer', {
      inputs: [{ name: 'data', type: 'artifact', source: stepA.step_id, required: true }],
      dependencies: [stepA.step_id],
    });
    const pv = makePlanVersion([stepA, stepB]);
    const result = validateContractDependencies(pv);
    expect(result.warnings).toEqual([]);
  });

  it('should not warn for optional inputs without dependency', () => {
    const stepA = createStep('Producer', { description: 'outputs stuff' });
    const stepB = makeStepWithContract('Consumer', {
      inputs: [{ name: 'data', type: 'artifact', source: stepA.step_id, required: false }],
      dependencies: [],
    });
    const pv = makePlanVersion([stepA, stepB]);
    const result = validateContractDependencies(pv);
    expect(result.warnings).toEqual([]);
  });

  it('should not warn for plan-level sources', () => {
    const step = makeStepWithContract('Consumer', {
      inputs: [{ name: 'config', type: 'context', source: 'plan', required: true }],
    });
    const pv = makePlanVersion([step]);
    const result = validateContractDependencies(pv);
    expect(result.warnings).toEqual([]);
  });

  it('should skip steps without contracts', () => {
    const stepA = createStep('Plain', { description: 'no contract' });
    const pv = makePlanVersion([stepA]);
    const result = validateContractDependencies(pv);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

// ============================================
// hasValidContract
// ============================================

describe('hasValidContract', () => {
  it('should return true for step without contract', () => {
    const step = createStep('No contract', { description: 'plain' });
    expect(hasValidContract(step)).toBe(true);
  });

  it('should return true for step with valid contract', () => {
    const step = makeStepWithContract('Valid', {
      inputs: [{ name: 'data', type: 'context', source: 'plan', required: true }],
    });
    expect(hasValidContract(step)).toBe(true);
  });

  it('should return true for step with empty contract', () => {
    const step = makeStepWithContract('Empty contract');
    expect(hasValidContract(step)).toBe(true);
  });
});

// ============================================
// getContractInputSources
// ============================================

describe('getContractInputSources', () => {
  it('should return all input sources', () => {
    const contract = createTaskContract({
      inputs: [
        createContractInput({ name: 'a', type: 'context', source: 'plan', required: true }),
        createContractInput({ name: 'b', type: 'artifact', source: 'step-1', required: true }),
        createContractInput({ name: 'c', type: 'parameter', source: 'step-2', required: false }),
      ],
    });
    const sources = getContractInputSources(contract);
    expect(sources).toEqual(['plan', 'step-1', 'step-2']);
  });

  it('should return empty for contract with no inputs', () => {
    const contract = createTaskContract({});
    const sources = getContractInputSources(contract);
    expect(sources).toEqual([]);
  });
});

// ============================================
// getRequiredInputSources
// ============================================

describe('getRequiredInputSources', () => {
  it('should return only required non-plan sources', () => {
    const contract = createTaskContract({
      inputs: [
        createContractInput({ name: 'a', type: 'context', source: 'plan', required: true }),
        createContractInput({ name: 'b', type: 'artifact', source: 'step-1', required: true }),
        createContractInput({ name: 'c', type: 'parameter', source: 'step-2', required: false }),
      ],
    });
    const sources = getRequiredInputSources(contract);
    expect(sources).toEqual(['step-1']); // plan excluded, step-2 is optional
  });

  it('should return empty when all sources are plan or optional', () => {
    const contract = createTaskContract({
      inputs: [
        createContractInput({ name: 'a', type: 'context', source: 'plan', required: true }),
        createContractInput({ name: 'b', type: 'artifact', source: 'step-1', required: false }),
      ],
    });
    const sources = getRequiredInputSources(contract);
    expect(sources).toEqual([]);
  });
});

// ============================================
// analyzeContractCoverage
// ============================================

describe('analyzeContractCoverage', () => {
  it('should calculate coverage for mixed plan', () => {
    const stepA = createStep('Plain', { description: 'no contract' });
    const stepB = makeStepWithContract('With contract', {
      inputs: [{ name: 'data', type: 'context', source: 'plan', required: true }],
      outputs: [{ name: 'result', type: 'file', validation: 'exists' }],
    });
    const stepC = makeStepWithContract('Outputs only', {
      outputs: [
        { name: 'out1', type: 'file', validation: 'exists' },
        { name: 'out2', type: 'directory', validation: 'exists' },
      ],
    });

    const pv = makePlanVersion([stepA, stepB, stepC]);
    const analysis = analyzeContractCoverage(pv);

    expect(analysis.totalSteps).toBe(3);
    expect(analysis.stepsWithContracts).toBe(2);
    expect(analysis.coveragePercent).toBe(67); // 2/3 rounded
    expect(analysis.stepsWithInputs).toBe(1);
    expect(analysis.stepsWithOutputs).toBe(2);
    expect(analysis.totalInputs).toBe(1);
    expect(analysis.totalOutputs).toBe(3);
  });

  it('should return 0% coverage for plan with no contracts', () => {
    const steps = [
      createStep('A', { description: 'no contract' }),
      createStep('B', { description: 'no contract' }),
    ];
    const pv = makePlanVersion(steps);
    const analysis = analyzeContractCoverage(pv);
    expect(analysis.coveragePercent).toBe(0);
    expect(analysis.stepsWithContracts).toBe(0);
  });

  it('should return 100% coverage when all steps have contracts', () => {
    const steps = [
      makeStepWithContract('S1', {
        inputs: [{ name: 'a', type: 'context', source: 'plan', required: true }],
      }),
      makeStepWithContract('S2', {
        outputs: [{ name: 'b', type: 'file', validation: 'exists' }],
      }),
    ];
    const pv = makePlanVersion(steps);
    const analysis = analyzeContractCoverage(pv);
    expect(analysis.coveragePercent).toBe(100);
  });

  it('should handle empty plan', () => {
    const pv = makePlanVersion([]);
    const analysis = analyzeContractCoverage(pv);
    expect(analysis.totalSteps).toBe(0);
    expect(analysis.coveragePercent).toBe(0);
  });
});
