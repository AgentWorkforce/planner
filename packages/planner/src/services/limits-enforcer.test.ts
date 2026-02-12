import { describe, it, expect, vi } from 'vitest';
import { createStep } from '../domain/step.js';
import { createPlanVersion } from '../domain/plan.js';
import type { PlanVersion } from '../domain/plan.js';
import { createDecompositionConfig, DEFAULT_DECOMPOSITION_CONFIG } from '../domain/decomposition-config.js';
import {
  groupStepsByScope,
  countStepsPerScope,
  validatePlanLimits,
  validateSubPlanDepth,
  validateAllSubPlanDepths,
  validateAllLimits,
  validateSubPlanReferences,
  validateSubPlansPublished,
  getStepDistributionSummary,
  type PlanStorage,
} from './limits-enforcer.js';

// ============================================
// Helpers
// ============================================

const PLAN_ID = '123e4567-e89b-12d3-a456-426614174000';
const SUB_PLAN_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SUB_PLAN_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SUB_PLAN_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SUB_PLAN_D = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makePlanVersion(steps: ReturnType<typeof createStep>[], overrides?: Partial<PlanVersion>): PlanVersion {
  const pv = createPlanVersion(PLAN_ID, 'Test goal');
  return { ...pv, steps, ...overrides } as PlanVersion;
}

function makeSteps(count: number, scope?: string): ReturnType<typeof createStep>[] {
  return Array.from({ length: count }, (_, i) =>
    createStep(`Step ${i + 1}`, { scope, description: `Task ${i + 1}` })
  );
}

function createMockStorage(plans: Map<string, PlanVersion>): PlanStorage {
  return {
    getLatestVersion: (planId: string) => plans.get(planId) ?? null,
    getPlan: (planId: string) => plans.has(planId) ? { plan_id: planId } as any : null,
  };
}

// ============================================
// groupStepsByScope
// ============================================

describe('groupStepsByScope', () => {
  it('should group steps with same scope', () => {
    const steps = [
      createStep('A', { scope: 'backend' }),
      createStep('B', { scope: 'backend' }),
      createStep('C', { scope: 'frontend' }),
    ];
    const groups = groupStepsByScope(steps);
    expect(groups.get('backend')?.length).toBe(2);
    expect(groups.get('frontend')?.length).toBe(1);
  });

  it('should use __default__ for steps without scope', () => {
    const steps = [
      createStep('A', { description: 'no scope' }),
      createStep('B', { scope: 'api' }),
    ];
    const groups = groupStepsByScope(steps);
    expect(groups.has('__default__')).toBe(true);
    expect(groups.get('__default__')?.length).toBe(1);
    expect(groups.get('api')?.length).toBe(1);
  });

  it('should return empty map for empty steps', () => {
    const groups = groupStepsByScope([]);
    expect(groups.size).toBe(0);
  });
});

// ============================================
// countStepsPerScope
// ============================================

describe('countStepsPerScope', () => {
  it('should count steps per scope and check limit', () => {
    const steps = [...makeSteps(5, 'api'), ...makeSteps(3, 'ui')];
    const counts = countStepsPerScope(steps, 4);

    const api = counts.find((c) => c.scope === 'api');
    const ui = counts.find((c) => c.scope === 'ui');

    expect(api?.count).toBe(5);
    expect(api?.exceeds).toBe(true);
    expect(ui?.count).toBe(3);
    expect(ui?.exceeds).toBe(false);
  });

  it('should display "(no scope)" for default scope', () => {
    const steps = [createStep('A', { description: 'test' })];
    const counts = countStepsPerScope(steps, 10);
    expect(counts[0].scope).toBe('(no scope)');
  });

  it('should not exceed when exactly at limit', () => {
    const steps = makeSteps(15, 'backend');
    const counts = countStepsPerScope(steps, 15);
    expect(counts[0].exceeds).toBe(false);
  });

  it('should exceed when one above limit', () => {
    const steps = makeSteps(16, 'backend');
    const counts = countStepsPerScope(steps, 15);
    expect(counts[0].exceeds).toBe(true);
  });
});

// ============================================
// validatePlanLimits
// ============================================

describe('validatePlanLimits', () => {
  it('should return valid for plan within limits', () => {
    const pv = makePlanVersion(makeSteps(10, 'api'));
    const result = validatePlanLimits(pv);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should warn when scope exceeds default limit (15)', () => {
    const pv = makePlanVersion(makeSteps(20, 'backend'));
    const result = validatePlanLimits(pv);
    expect(result.valid).toBe(true); // warnings only, no errors
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("Scope 'backend'");
    expect(result.warnings[0]).toContain('20 steps');
    expect(result.warnings[0]).toContain('max 15');
  });

  it('should use custom limit from DecompositionConfig', () => {
    const pv = makePlanVersion(makeSteps(8, 'api'));
    const config = createDecompositionConfig({ maxStepsPerScope: 5 });
    const result = validatePlanLimits(pv, config);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('max 5');
  });

  it('should use plan version decomposition_config', () => {
    const config = createDecompositionConfig({ maxStepsPerScope: 5 });
    const pv = makePlanVersion(makeSteps(8, 'api'), { decomposition_config: config });
    const result = validatePlanLimits(pv);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('max 5');
  });

  it('should warn per exceeding scope independently', () => {
    const steps = [...makeSteps(20, 'api'), ...makeSteps(18, 'ui'), ...makeSteps(5, 'db')];
    const pv = makePlanVersion(steps);
    const result = validatePlanLimits(pv);
    expect(result.warnings.length).toBe(2); // api and ui exceed, db doesn't
  });

  it('should return valid for empty plan', () => {
    const pv = makePlanVersion([]);
    const result = validatePlanLimits(pv);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

// ============================================
// validateSubPlanDepth
// ============================================

describe('validateSubPlanDepth', () => {
  it('should return valid for plan with no sub-plans', () => {
    const pv = makePlanVersion(makeSteps(3, 'api'));
    const storage = createMockStorage(new Map([[PLAN_ID, pv]]));

    const result = validateSubPlanDepth(PLAN_ID, storage);
    expect(result.valid).toBe(true);
    expect(result.depth).toBe(1);
  });

  it('should return valid for depth within limit', () => {
    // PLAN_ID -> SUB_PLAN_A -> SUB_PLAN_B (depth 3, limit 3)
    const pvC = makePlanVersion(makeSteps(2, 'api'));
    const pvB = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_B, description: 'nested' })],
    );
    const pvA = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_A, description: 'nested' })],
    );

    const plans = new Map<string, PlanVersion>([
      [PLAN_ID, { ...pvA, plan_id: PLAN_ID } as PlanVersion],
      [SUB_PLAN_A, { ...pvB, plan_id: SUB_PLAN_A } as PlanVersion],
      [SUB_PLAN_B, { ...pvC, plan_id: SUB_PLAN_B } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);

    const result = validateSubPlanDepth(PLAN_ID, storage, 3);
    expect(result.valid).toBe(true);
    expect(result.depth).toBe(3);
    expect(result.path).toEqual([PLAN_ID, SUB_PLAN_A, SUB_PLAN_B]);
  });

  it('should return error when depth exceeds limit', () => {
    // 4 levels deep with max_depth = 2
    const pvD = makePlanVersion(makeSteps(1));
    const pvC = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_D })],
    );
    const pvB = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_C })],
    );
    const pvA = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_B })],
    );

    const plans = new Map<string, PlanVersion>([
      [PLAN_ID, { ...pvA, plan_id: PLAN_ID } as PlanVersion],
      [SUB_PLAN_B, { ...pvB, plan_id: SUB_PLAN_B } as PlanVersion],
      [SUB_PLAN_C, { ...pvC, plan_id: SUB_PLAN_C } as PlanVersion],
      [SUB_PLAN_D, { ...pvD, plan_id: SUB_PLAN_D } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);

    const result = validateSubPlanDepth(PLAN_ID, storage, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('should detect circular references', () => {
    // PLAN_ID -> SUB_PLAN_A -> PLAN_ID (circular)
    const pvA = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_A })],
    );
    const pvB = makePlanVersion(
      [createStep('Sub', { sub_plan_id: PLAN_ID })],
    );

    const plans = new Map<string, PlanVersion>([
      [PLAN_ID, { ...pvA, plan_id: PLAN_ID } as PlanVersion],
      [SUB_PLAN_A, { ...pvB, plan_id: SUB_PLAN_A } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);

    const result = validateSubPlanDepth(PLAN_ID, storage, 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular');
  });

  it('should handle non-existent sub-plan gracefully', () => {
    const pv = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_A })],
    );
    const plans = new Map<string, PlanVersion>([
      [PLAN_ID, { ...pv, plan_id: PLAN_ID } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);

    const result = validateSubPlanDepth(PLAN_ID, storage);
    // Non-existent plan is not an error, traversal just stops
    expect(result.valid).toBe(true);
  });

  it('should use default max_depth when not specified', () => {
    const pv = makePlanVersion(makeSteps(2));
    const storage = createMockStorage(new Map([[PLAN_ID, pv]]));
    const result = validateSubPlanDepth(PLAN_ID, storage);
    expect(result.maxDepth).toBe(DEFAULT_DECOMPOSITION_CONFIG.max_depth);
  });
});

// ============================================
// validateAllSubPlanDepths
// ============================================

describe('validateAllSubPlanDepths', () => {
  it('should return valid for plan without sub-plans', () => {
    const pv = makePlanVersion(makeSteps(3, 'api'));
    const storage = createMockStorage(new Map());
    const result = validateAllSubPlanDepths(pv, storage);
    expect(result.valid).toBe(true);
  });

  it('should error when sub-plans are not allowed', () => {
    const config = createDecompositionConfig({ allowSubPlans: false });
    const pv = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_A })],
      { decomposition_config: config }
    );
    const storage = createMockStorage(new Map());
    const result = validateAllSubPlanDepths(pv, storage);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not allowed');
  });

  it('should validate each sub-plan reference independently', () => {
    const pv = makePlanVersion([
      createStep('Sub A', { sub_plan_id: SUB_PLAN_A }),
      createStep('Sub B', { sub_plan_id: SUB_PLAN_B }),
    ]);
    // Both sub-plans are leaf nodes (no further nesting)
    const pvA = makePlanVersion(makeSteps(1));
    const pvB = makePlanVersion(makeSteps(1));
    const plans = new Map<string, PlanVersion>([
      [SUB_PLAN_A, { ...pvA, plan_id: SUB_PLAN_A } as PlanVersion],
      [SUB_PLAN_B, { ...pvB, plan_id: SUB_PLAN_B } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);
    const result = validateAllSubPlanDepths(pv, storage);
    expect(result.valid).toBe(true);
  });
});

// ============================================
// validateSubPlanReferences
// ============================================

describe('validateSubPlanReferences', () => {
  it('should return valid for plan without sub-plans', () => {
    const pv = makePlanVersion(makeSteps(3, 'api'));
    const storage = createMockStorage(new Map());
    const result = validateSubPlanReferences(pv, storage);
    expect(result.valid).toBe(true);
  });

  it('should error when sub-plan does not exist', () => {
    const pv = makePlanVersion([
      createStep('Sub', { sub_plan_id: SUB_PLAN_A }),
    ]);
    const storage = createMockStorage(new Map());
    const result = validateSubPlanReferences(pv, storage);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('does not exist');
  });

  it('should warn when sub-plan has no versions', () => {
    const pv = makePlanVersion([
      createStep('Sub', { sub_plan_id: SUB_PLAN_A }),
    ]);
    // Plan exists but no version in the map (getPlan returns truthy, getLatestVersion returns null)
    const storage: PlanStorage = {
      getPlan: (planId: string) => planId === SUB_PLAN_A ? { plan_id: SUB_PLAN_A } as any : null,
      getLatestVersion: () => null,
    };
    const result = validateSubPlanReferences(pv, storage);
    expect(result.valid).toBe(true); // warnings only
    expect(result.warnings[0]).toContain('no versions');
  });

  it('should pass when all references are valid', () => {
    const pv = makePlanVersion([
      createStep('Sub A', { sub_plan_id: SUB_PLAN_A }),
      createStep('Sub B', { sub_plan_id: SUB_PLAN_B }),
    ]);
    const pvA = makePlanVersion(makeSteps(1));
    const pvB = makePlanVersion(makeSteps(1));
    const plans = new Map<string, PlanVersion>([
      [SUB_PLAN_A, { ...pvA, plan_id: SUB_PLAN_A } as PlanVersion],
      [SUB_PLAN_B, { ...pvB, plan_id: SUB_PLAN_B } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);
    const result = validateSubPlanReferences(pv, storage);
    expect(result.valid).toBe(true);
  });
});

// ============================================
// validateSubPlansPublished
// ============================================

describe('validateSubPlansPublished', () => {
  it('should return valid for plan without sub-plans', () => {
    const pv = makePlanVersion(makeSteps(3, 'api'));
    const storage = createMockStorage(new Map());
    const result = validateSubPlansPublished(pv, storage);
    expect(result.valid).toBe(true);
  });

  it('should error when sub-plan is not published', () => {
    const pv = makePlanVersion([
      createStep('Sub', { sub_plan_id: SUB_PLAN_A }),
    ]);
    const pvA = makePlanVersion(makeSteps(1)); // status defaults to 'draft'
    const plans = new Map<string, PlanVersion>([
      [SUB_PLAN_A, { ...pvA, plan_id: SUB_PLAN_A } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);
    const result = validateSubPlansPublished(pv, storage);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be published first');
  });

  it('should pass when all sub-plans are published', () => {
    const pv = makePlanVersion([
      createStep('Sub', { sub_plan_id: SUB_PLAN_A }),
    ]);
    const pvA = makePlanVersion(makeSteps(1), { status: 'published' as any });
    const plans = new Map<string, PlanVersion>([
      [SUB_PLAN_A, { ...pvA, plan_id: SUB_PLAN_A } as PlanVersion],
    ]);
    const storage = createMockStorage(plans);
    const result = validateSubPlansPublished(pv, storage);
    expect(result.valid).toBe(true);
  });
});

// ============================================
// validateAllLimits
// ============================================

describe('validateAllLimits', () => {
  it('should combine step limits and depth validation', () => {
    // 20 steps in one scope (triggers warning) + no sub-plans
    const pv = makePlanVersion(makeSteps(20, 'backend'));
    const storage = createMockStorage(new Map());
    const result = validateAllLimits(pv, storage);
    expect(result.valid).toBe(true); // step limit is warning only
    expect(result.warnings.length).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('should aggregate errors from depth validation', () => {
    const config = createDecompositionConfig({ allowSubPlans: false });
    const pv = makePlanVersion(
      [createStep('Sub', { sub_plan_id: SUB_PLAN_A })],
      { decomposition_config: config }
    );
    const storage = createMockStorage(new Map());
    const result = validateAllLimits(pv, storage);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return valid for well-formed plan', () => {
    const pv = makePlanVersion(makeSteps(5, 'api'));
    const storage = createMockStorage(new Map());
    const result = validateAllLimits(pv, storage);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

// ============================================
// getStepDistributionSummary
// ============================================

describe('getStepDistributionSummary', () => {
  it('should summarize step distribution', () => {
    const steps = [...makeSteps(5, 'api'), ...makeSteps(3, 'ui')];
    const pv = makePlanVersion(steps);
    const summary = getStepDistributionSummary(pv);

    expect(summary.totalSteps).toBe(8);
    expect(summary.scopeCount).toBe(2);
    expect(summary.maxStepsInScope).toBe(5);
    expect(summary.averageStepsPerScope).toBe(4);
    expect(summary.scopeCounts.length).toBe(2);
  });

  it('should handle empty plan', () => {
    const pv = makePlanVersion([]);
    const summary = getStepDistributionSummary(pv);
    expect(summary.totalSteps).toBe(0);
    expect(summary.scopeCount).toBe(0);
    expect(summary.maxStepsInScope).toBe(0);
    expect(summary.averageStepsPerScope).toBe(0);
  });

  it('should handle single scope', () => {
    const pv = makePlanVersion(makeSteps(10, 'backend'));
    const summary = getStepDistributionSummary(pv);
    expect(summary.totalSteps).toBe(10);
    expect(summary.scopeCount).toBe(1);
    expect(summary.maxStepsInScope).toBe(10);
    expect(summary.averageStepsPerScope).toBe(10);
  });

  it('should use plan decomposition_config limit', () => {
    const config = createDecompositionConfig({ maxStepsPerScope: 5 });
    const pv = makePlanVersion(makeSteps(8, 'api'), { decomposition_config: config });
    const summary = getStepDistributionSummary(pv);
    expect(summary.scopeCounts[0].limit).toBe(5);
    expect(summary.scopeCounts[0].exceeds).toBe(true);
  });
});
