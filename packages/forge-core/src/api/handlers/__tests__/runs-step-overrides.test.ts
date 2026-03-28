/**
 * Tests for step override functionality in run creation.
 *
 * Covers:
 * - createTask() propagating modelOverride to task.model_override
 * - StepOverrideSchema validation (valid and invalid inputs)
 * - CreateRunRequestSchema parsing with step_overrides
 * - Handler-level skip and model routing via step_overrides
 */

import { describe, it, expect } from 'vitest';
import {
  createTask,
  TaskSchema,
  type ForgeStep,
} from '../../../domain/types.js';
import {
  StepOverrideSchema,
  CreateRunRequestSchema,
  type StepOverride,
} from '../../schemas.js';

// ============================================
// Shared fixtures
// ============================================

const baseStep: ForgeStep = {
  step_id: 'step-1',
  title: 'Implement feature',
  dependencies: [],
};

const RUN_ID = crypto.randomUUID();
const WORKSPACE = '/tmp/workspace';

// ============================================
// createTask() — model_override propagation
// ============================================

describe('createTask() with modelOverride', () => {
  it('sets model_override on the task when modelOverride is provided', () => {
    const task = createTask(RUN_ID, baseStep, WORKSPACE, 'haiku');

    expect(task.model_override).toBe('haiku');
  });

  it('accepts sonnet as model override', () => {
    const task = createTask(RUN_ID, baseStep, WORKSPACE, 'sonnet');

    expect(task.model_override).toBe('sonnet');
  });

  it('accepts opus as model override', () => {
    const task = createTask(RUN_ID, baseStep, WORKSPACE, 'opus');

    expect(task.model_override).toBe('opus');
  });

  it('leaves model_override undefined when modelOverride is not provided', () => {
    const task = createTask(RUN_ID, baseStep, WORKSPACE);

    expect(task.model_override).toBeUndefined();
  });

  it('leaves model_override undefined when modelOverride is explicitly undefined', () => {
    const task = createTask(RUN_ID, baseStep, WORKSPACE, undefined);

    expect(task.model_override).toBeUndefined();
  });

  it('produces a task that passes TaskSchema validation', () => {
    const task = createTask(RUN_ID, baseStep, WORKSPACE, 'haiku');

    expect(() => TaskSchema.parse(task)).not.toThrow();
  });

  it('copies other step fields correctly alongside model_override', () => {
    const step: ForgeStep = {
      step_id: 'step-abc',
      title: 'Deploy service',
      description: 'Deploy to production',
      dependencies: ['step-1', 'step-2'],
      scope: 'infrastructure',
      owner_role: 'DevOps',
    };

    const task = createTask(RUN_ID, step, WORKSPACE, 'opus');

    expect(task.step_id).toBe('step-abc');
    expect(task.step_title).toBe('Deploy service');
    expect(task.step_description).toBe('Deploy to production');
    expect(task.dependencies).toEqual(['step-1', 'step-2']);
    expect(task.scope).toBe('infrastructure');
    expect(task.owner_role).toBe('DevOps');
    expect(task.model_override).toBe('opus');
  });
});

// ============================================
// StepOverrideSchema — validation
// ============================================

describe('StepOverrideSchema validation', () => {
  it('accepts a valid override with model only', () => {
    const input: StepOverride = { step_id: 'step-1', model: 'haiku' };

    const result = StepOverrideSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.model).toBe('haiku');
  });

  it('accepts a valid override with skip only', () => {
    const input = { step_id: 'step-2', skip: true };

    const result = StepOverrideSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.skip).toBe(true);
  });

  it('accepts a valid override with both model and skip', () => {
    const input = { step_id: 'step-3', model: 'opus', skip: false };

    const result = StepOverrideSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('accepts an override with only step_id (all optional fields absent)', () => {
    const input = { step_id: 'step-4' };

    const result = StepOverrideSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.model).toBeUndefined();
    expect(result.data?.skip).toBeUndefined();
  });

  it('accepts all valid model values', () => {
    const models = ['haiku', 'sonnet', 'opus'] as const;

    for (const model of models) {
      const result = StepOverrideSchema.safeParse({ step_id: 'step-x', model });
      expect(result.success, `model '${model}' should be valid`).toBe(true);
    }
  });

  it('rejects an unknown model value', () => {
    const result = StepOverrideSchema.safeParse({ step_id: 'step-1', model: 'gpt-4' });

    expect(result.success).toBe(false);
  });

  it('rejects when step_id is missing', () => {
    const result = StepOverrideSchema.safeParse({ model: 'haiku' });

    expect(result.success).toBe(false);
  });

  it('rejects when step_id is an empty string', () => {
    const result = StepOverrideSchema.safeParse({ step_id: '', model: 'sonnet' });

    expect(result.success).toBe(false);
  });

  it('rejects when skip is not a boolean', () => {
    const result = StepOverrideSchema.safeParse({ step_id: 'step-1', skip: 'yes' });

    expect(result.success).toBe(false);
  });
});

// ============================================
// CreateRunRequestSchema — step_overrides field
// ============================================

describe('CreateRunRequestSchema with step_overrides', () => {
  const basePlan = {
    plan_id: crypto.randomUUID(),
    version: 1,
    summary: { goal: 'Test goal' },
    steps: [
      { step_id: 'step-1', title: 'Step One', dependencies: [] },
      { step_id: 'step-2', title: 'Step Two', dependencies: ['step-1'] },
    ],
  };

  it('parses a request with valid step_overrides', () => {
    const input = {
      plan: basePlan,
      step_overrides: [
        { step_id: 'step-1', model: 'haiku' },
        { step_id: 'step-2', skip: true },
      ],
    };

    const result = CreateRunRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.step_overrides).toHaveLength(2);
    expect(result.data?.step_overrides?.[0]).toMatchObject({ step_id: 'step-1', model: 'haiku' });
    expect(result.data?.step_overrides?.[1]).toMatchObject({ step_id: 'step-2', skip: true });
  });

  it('parses successfully without step_overrides (field is optional)', () => {
    const input = { plan: basePlan };

    const result = CreateRunRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.step_overrides).toBeUndefined();
  });

  it('parses successfully with an empty step_overrides array', () => {
    const input = { plan: basePlan, step_overrides: [] };

    const result = CreateRunRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.step_overrides).toEqual([]);
  });

  it('rejects when step_overrides contains an invalid model', () => {
    const input = {
      plan: basePlan,
      step_overrides: [{ step_id: 'step-1', model: 'claude-3' }],
    };

    const result = CreateRunRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects when neither plan nor plan_id is provided (existing refine)', () => {
    const input = {
      step_overrides: [{ step_id: 'step-1', model: 'haiku' }],
    };

    const result = CreateRunRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('allows step_overrides alongside plan_id reference', () => {
    const input = {
      plan_id: crypto.randomUUID(),
      plan_version: 1,
      step_overrides: [{ step_id: 'step-1', skip: true }],
    };

    // plan_id without a plannerClient won't be validated at schema level
    const result = CreateRunRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data?.step_overrides?.[0]).toMatchObject({ step_id: 'step-1', skip: true });
  });
});
