import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStep } from '../../domain/step.js';
import { createPlanVersion } from '../../domain/plan.js';
import type { PlanVersion } from '../../domain/plan.js';
import type { Step } from '../../domain/step.js';
import { DEFAULT_PLANNER_CONFIG } from '../../tuner/config.js';
import {
  enrichStep,
  enrichSteps,
  enrichPlanVersion,
  enrichPlanVersionForCreate,
  enrichPlanVersionForUpdate,
} from './dot-enrichment.js';

// ============================================
// Helpers
// ============================================

const PLAN_ID = '123e4567-e89b-12d3-a456-426614174000';

function makePlanVersion(steps: Step[]): PlanVersion {
  const pv = createPlanVersion(PLAN_ID, 'Test goal');
  return { ...pv, steps } as PlanVersion;
}

// ============================================
// enrichStep
// ============================================

describe('enrichStep', () => {
  it('should add language_tier to step', () => {
    const step = createStep('Python task', { description: 'Edit main.py' });
    const result = enrichStep(step, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.language_tier).toBe('s');
  });

  it('should add complexity_estimate to step', () => {
    const step = createStep('Task', { description: 'Write some code' });
    const result = enrichStep(step, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.complexity_estimate).toBeDefined();
    expect(result.complexity_estimate?.score).toBeGreaterThanOrEqual(0);
  });

  it('should preserve existing language_tier', () => {
    const step = createStep('Task', {
      description: 'Edit main.py',
      language_tier: 'd',
    });
    const result = enrichStep(step, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.language_tier).toBe('d');
  });

  it('should preserve existing complexity_estimate', () => {
    const existing = {
      level: 'complex' as const,
      score: 80,
      confidence: 0.9,
      signals: {
        description_tokens: 100,
        scope_count: 1,
        dependency_count: 0,
        ac_count: 0,
        keyword_boost: 0,
        language_multiplier: 1.0,
      },
      recommendation: 'require_decomposition' as const,
    };
    const step = createStep('Task', {
      description: 'Edit main.py',
      complexity_estimate: existing,
    });
    const result = enrichStep(step, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.complexity_estimate).toEqual(existing);
  });

  it('should override existing values with forceReenrich', () => {
    const step = createStep('Task', {
      description: 'Edit main.py',
      language_tier: 'd',
    });
    const result = enrichStep(step, {
      config: DEFAULT_PLANNER_CONFIG,
      forceReenrich: true,
    });
    expect(result.language_tier).toBe('s'); // detected from .py
  });

  it('should skip language detection when option set', () => {
    const step = createStep('Task', { description: 'Edit main.py' });
    const result = enrichStep(step, {
      config: DEFAULT_PLANNER_CONFIG,
      skipLanguageDetection: true,
    });
    expect(result.language_tier).toBeUndefined();
  });

  it('should skip complexity estimation when option set', () => {
    const step = createStep('Task', { description: 'Some work' });
    const result = enrichStep(step, {
      config: DEFAULT_PLANNER_CONFIG,
      skipComplexityEstimation: true,
    });
    expect(result.complexity_estimate).toBeUndefined();
  });

  it('should use detected language tier in complexity calculation', () => {
    const step = createStep('Task', {
      description: 'Fix legacy.cob program with some changes',
    });
    const result = enrichStep(step, { config: DEFAULT_PLANNER_CONFIG });
    // .cob => tier D => 5.0x multiplier, so score should be higher
    expect(result.language_tier).toBe('d');
    expect(result.complexity_estimate).toBeDefined();
  });

  it('should not mutate original step', () => {
    const step = createStep('Task', { description: 'Edit main.py' });
    const original = { ...step };
    enrichStep(step, { config: DEFAULT_PLANNER_CONFIG });
    expect(step.language_tier).toEqual(original.language_tier);
    expect(step.complexity_estimate).toEqual(original.complexity_estimate);
  });
});

// ============================================
// enrichSteps
// ============================================

describe('enrichSteps', () => {
  it('should enrich all steps needing enrichment', () => {
    const steps = [
      createStep('A', { description: 'Edit main.py' }),
      createStep('B', { description: 'Write server.go' }),
    ];
    const result = enrichSteps(steps, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.enrichedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.steps[0].language_tier).toBeDefined();
    expect(result.steps[1].language_tier).toBeDefined();
  });

  it('should skip steps already enriched', () => {
    const steps = [
      createStep('A', {
        description: 'Edit main.py',
        language_tier: 's',
        complexity_estimate: {
          level: 'trivial',
          score: 5,
          confidence: 0.5,
          signals: {
            description_tokens: 3,
            scope_count: 0,
            dependency_count: 0,
            ac_count: 0,
            keyword_boost: 0,
            language_multiplier: 1.0,
          },
          recommendation: 'proceed',
        },
      }),
    ];
    const result = enrichSteps(steps, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.enrichedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('should handle empty steps array', () => {
    const result = enrichSteps([], { config: DEFAULT_PLANNER_CONFIG });
    expect(result.enrichedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.steps).toEqual([]);
  });
});

// ============================================
// enrichPlanVersion
// ============================================

describe('enrichPlanVersion', () => {
  it('should return new plan version with enriched steps', () => {
    const pv = makePlanVersion([
      createStep('Task', { description: 'Edit main.py' }),
    ]);
    const result = enrichPlanVersion(pv, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.steps[0].language_tier).toBeDefined();
    expect(result.steps[0].complexity_estimate).toBeDefined();
    // updated_at should be changed
    expect(result.updated_at).not.toBe(pv.updated_at);
  });

  it('should preserve other plan version fields', () => {
    const pv = makePlanVersion([createStep('Task', { description: 'work' })]);
    const result = enrichPlanVersion(pv, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.plan_id).toBe(pv.plan_id);
    expect(result.version).toBe(pv.version);
    expect(result.status).toBe(pv.status);
    expect(result.summary).toEqual(pv.summary);
  });
});

// ============================================
// enrichPlanVersionForCreate
// ============================================

describe('enrichPlanVersionForCreate', () => {
  it('should enrich all steps', () => {
    const pv = makePlanVersion([
      createStep('A', { description: 'Edit main.py' }),
      createStep('B', { description: 'Build server.go' }),
    ]);
    const result = enrichPlanVersionForCreate(pv, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.steps[0].language_tier).toBeDefined();
    expect(result.steps[1].language_tier).toBeDefined();
  });

  it('should not override manually specified values', () => {
    const pv = makePlanVersion([
      createStep('A', { description: 'Edit main.py', language_tier: 'd' }),
    ]);
    const result = enrichPlanVersionForCreate(pv, { config: DEFAULT_PLANNER_CONFIG });
    expect(result.steps[0].language_tier).toBe('d');
  });
});

// ============================================
// enrichPlanVersionForUpdate
// ============================================

describe('enrichPlanVersionForUpdate', () => {
  it('should enrich new steps not in original', () => {
    const originalSteps = [createStep('Existing', { description: 'old step' })];
    const newStep = createStep('New', { description: 'Edit main.py' });
    const pv = makePlanVersion([...originalSteps, newStep]);

    const result = enrichPlanVersionForUpdate(pv, originalSteps, {
      config: DEFAULT_PLANNER_CONFIG,
    });

    // New step should be enriched
    const enrichedNew = result.steps.find((s) => s.step_id === newStep.step_id);
    expect(enrichedNew?.language_tier).toBeDefined();
  });

  it('should enrich existing steps missing DOT fields', () => {
    const existingStep = createStep('Existing', { description: 'Edit main.py' });
    const pv = makePlanVersion([existingStep]);

    const result = enrichPlanVersionForUpdate(pv, [existingStep], {
      config: DEFAULT_PLANNER_CONFIG,
    });

    // Existing step without DOT fields should be enriched
    expect(result.steps[0].language_tier).toBeDefined();
  });

  it('should skip existing steps with DOT fields', () => {
    const existingStep = createStep('Existing', {
      description: 'Edit main.py',
      language_tier: 'd',
      complexity_estimate: {
        level: 'trivial',
        score: 5,
        confidence: 0.5,
        signals: {
          description_tokens: 3,
          scope_count: 0,
          dependency_count: 0,
          ac_count: 0,
          keyword_boost: 0,
          language_multiplier: 1.0,
        },
        recommendation: 'proceed',
      },
    });
    const pv = makePlanVersion([existingStep]);

    const result = enrichPlanVersionForUpdate(pv, [existingStep], {
      config: DEFAULT_PLANNER_CONFIG,
    });

    // Should keep manual override
    expect(result.steps[0].language_tier).toBe('d');
  });
});
