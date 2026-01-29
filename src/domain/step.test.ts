import { describe, it, expect } from 'vitest';
import {
  AcceptanceCriterionSchema,
} from './criterion.js';
import { GateSchema } from './gate.js';
import {
  StepSchema,
  createStep,
  validateStepDag,
} from './step.js';

describe('AcceptanceCriterion', () => {
  it('should validate criterion with id and description', () => {
    const result = AcceptanceCriterionSchema.parse({
      id: 'ac1',
      description: 'Test criterion',
    });
    expect(result.id).toBe('ac1');
    expect(result.description).toBe('Test criterion');
    expect(result.type).toBeUndefined();
  });

  it('should validate criterion with optional type', () => {
    const result = AcceptanceCriterionSchema.parse({
      id: 'ac1',
      description: 'Test criterion',
      type: 'test',
    });
    expect(result.type).toBe('test');
  });

  it('should reject empty id', () => {
    expect(() =>
      AcceptanceCriterionSchema.parse({ id: '', description: 'Test' })
    ).toThrow();
  });

  it('should allow empty description (permitted during editing)', () => {
    const result = AcceptanceCriterionSchema.parse({ id: 'ac1', description: '' });
    expect(result.id).toBe('ac1');
    expect(result.description).toBe('');
  });
});

describe('Gate', () => {
  it('should validate gate with human_approval type', () => {
    const result = GateSchema.parse({ type: 'human_approval' });
    expect(result.type).toBe('human_approval');
    expect(result.approver_role).toBeUndefined();
  });

  it('should validate gate with approver_role', () => {
    const result = GateSchema.parse({
      type: 'human_approval',
      approver_role: 'tech_lead',
    });
    expect(result.approver_role).toBe('tech_lead');
  });

  it('should reject invalid gate type', () => {
    expect(() => GateSchema.parse({ type: 'auto' })).toThrow();
  });
});

describe('Step', () => {
  it('should validate step with required fields', () => {
    const result = StepSchema.parse({
      step_id: 'step1',
      title: 'Test step',
    });
    expect(result.step_id).toBe('step1');
    expect(result.title).toBe('Test step');
    expect(result.dependencies).toEqual([]);
  });

  it('should validate step with all optional fields', () => {
    const result = StepSchema.parse({
      step_id: 'step1',
      title: 'Test step',
      scope: 'backend',
      description: 'A test step',
      dependencies: ['step0'],
      owner_role: 'backend:Coder',
      acceptance_criteria: [{ id: 'ac1', description: 'Test criterion' }],
      gate: { type: 'human_approval', approver_role: 'tech_lead' },
      sub_plan_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.scope).toBe('backend');
    expect(result.description).toBe('A test step');
    expect(result.dependencies).toEqual(['step0']);
    expect(result.owner_role).toBe('backend:Coder');
    expect(result.acceptance_criteria).toHaveLength(1);
    expect(result.gate?.type).toBe('human_approval');
    expect(result.sub_plan_id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should reject empty step_id', () => {
    expect(() =>
      StepSchema.parse({ step_id: '', title: 'Test' })
    ).toThrow();
  });

  it('should reject empty title', () => {
    expect(() =>
      StepSchema.parse({ step_id: 'step1', title: '' })
    ).toThrow();
  });

  it('should reject invalid sub_plan_id', () => {
    expect(() =>
      StepSchema.parse({
        step_id: 'step1',
        title: 'Test',
        sub_plan_id: 'not-a-uuid',
      })
    ).toThrow();
  });
});

describe('createStep', () => {
  it('should create step with title only', () => {
    const step = createStep('Test step');
    expect(step.title).toBe('Test step');
    expect(step.step_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(step.dependencies).toEqual([]);
  });

  it('should create step with all options', () => {
    const step = createStep('Test step', {
      scope: 'backend',
      description: 'Description',
      owner_role: 'backend:Coder',
      dependencies: ['step0'],
      acceptance_criteria: [{ id: 'ac1', description: 'Test' }],
      gate: { type: 'human_approval' },
    });
    expect(step.scope).toBe('backend');
    expect(step.description).toBe('Description');
    expect(step.owner_role).toBe('backend:Coder');
    expect(step.dependencies).toEqual(['step0']);
    expect(step.acceptance_criteria).toHaveLength(1);
    expect(step.gate?.type).toBe('human_approval');
  });

  it('should generate unique step_ids', () => {
    const step1 = createStep('Step 1');
    const step2 = createStep('Step 2');
    expect(step1.step_id).not.toBe(step2.step_id);
  });

  it('should pass schema validation', () => {
    const step = createStep('Test step');
    expect(() => StepSchema.parse(step)).not.toThrow();
  });
});

describe('validateStepDag', () => {
  it('should return true for empty steps', () => {
    expect(validateStepDag([])).toBe(true);
  });

  it('should return true for single step with no dependencies', () => {
    expect(
      validateStepDag([{ step_id: 'a', title: 'A', dependencies: [] }])
    ).toBe(true);
  });

  it('should return true for valid linear dependency chain', () => {
    const steps = [
      { step_id: 'a', title: 'A', dependencies: [] },
      { step_id: 'b', title: 'B', dependencies: ['a'] },
      { step_id: 'c', title: 'C', dependencies: ['b'] },
    ];
    expect(validateStepDag(steps)).toBe(true);
  });

  it('should return true for valid diamond dependency', () => {
    const steps = [
      { step_id: 'a', title: 'A', dependencies: [] },
      { step_id: 'b', title: 'B', dependencies: ['a'] },
      { step_id: 'c', title: 'C', dependencies: ['a'] },
      { step_id: 'd', title: 'D', dependencies: ['b', 'c'] },
    ];
    expect(validateStepDag(steps)).toBe(true);
  });

  it('should return false for direct cycle', () => {
    const steps = [
      { step_id: 'a', title: 'A', dependencies: ['b'] },
      { step_id: 'b', title: 'B', dependencies: ['a'] },
    ];
    expect(validateStepDag(steps)).toBe(false);
  });

  it('should return false for indirect cycle', () => {
    const steps = [
      { step_id: 'a', title: 'A', dependencies: ['c'] },
      { step_id: 'b', title: 'B', dependencies: ['a'] },
      { step_id: 'c', title: 'C', dependencies: ['b'] },
    ];
    expect(validateStepDag(steps)).toBe(false);
  });

  it('should return false for self-reference', () => {
    const steps = [{ step_id: 'a', title: 'A', dependencies: ['a'] }];
    expect(validateStepDag(steps)).toBe(false);
  });

  it('should return false for reference to non-existent step', () => {
    const steps = [
      { step_id: 'a', title: 'A', dependencies: [] },
      { step_id: 'b', title: 'B', dependencies: ['nonexistent'] },
    ];
    expect(validateStepDag(steps)).toBe(false);
  });
});
