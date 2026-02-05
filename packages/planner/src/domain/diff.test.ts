import { describe, it, expect } from 'vitest';
import {
  createVersionFrom,
  computeDiff,
  toJsonPatch,
  type VersionDiff,
} from './diff.js';
import { createPlanVersion, type PlanVersion } from './plan.js';
import { PlanStatus } from './status.js';
import { createStep } from './step.js';

describe('createVersionFrom', () => {
  it('should increment version number', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const v1 = createPlanVersion(planId, 'Test goal');
    const v2 = createVersionFrom(v1);

    expect(v2.version).toBe(2);
  });

  it('should set status to draft', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const v1 = createPlanVersion(planId, 'Test goal');
    // Simulate approved version
    const approved: PlanVersion = { ...v1, status: PlanStatus.Approved };
    const v2 = createVersionFrom(approved);

    expect(v2.status).toBe(PlanStatus.Draft);
  });

  it('should copy steps from source', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const v1 = createPlanVersion(planId, 'Test goal');
    const step = createStep('Test step');
    v1.steps.push(step);

    const v2 = createVersionFrom(v1);

    expect(v2.steps).toHaveLength(1);
    expect(v2.steps[0]?.step_id).toBe(step.step_id);
  });

  it('should have fresh timestamps', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    // Create v1 with a fixed past timestamp
    const v1 = createPlanVersion(planId, 'Test goal');
    (v1 as { created_at: string }).created_at = '2020-01-01T00:00:00.000Z';

    const v2 = createVersionFrom(v1);

    // v2 should have a current timestamp, not the old one
    expect(v2.created_at).not.toBe('2020-01-01T00:00:00.000Z');
    expect(new Date(v2.created_at).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('should preserve plan_id', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const v1 = createPlanVersion(planId, 'Test goal');
    const v2 = createVersionFrom(v1);

    expect(v2.plan_id).toBe(planId);
  });

  it('should copy summary', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const v1 = createPlanVersion(planId, 'Test goal', 'Test context');
    const v2 = createVersionFrom(v1);

    expect(v2.summary.goal).toBe('Test goal');
    expect(v2.summary.context).toBe('Test context');
  });
});

describe('computeDiff', () => {
  const planId = '123e4567-e89b-12d3-a456-426614174000';

  it('should detect no changes between identical versions', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const v2 = createVersionFrom(v1);

    const diff = computeDiff(v1, v2);

    expect(diff.summary_changed).toBe(false);
    expect(diff.steps_added).toHaveLength(0);
    expect(diff.steps_removed).toHaveLength(0);
    expect(diff.steps_modified).toHaveLength(0);
  });

  it('should detect added steps', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const v2 = createVersionFrom(v1);
    const newStep = createStep('New step');
    v2.steps.push(newStep);

    const diff = computeDiff(v1, v2);

    expect(diff.steps_added).toHaveLength(1);
    expect(diff.steps_added[0]?.step_id).toBe(newStep.step_id);
  });

  it('should detect removed steps', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const step = createStep('Step to remove');
    v1.steps.push(step);
    const v2 = createVersionFrom(v1);
    v2.steps.pop();

    const diff = computeDiff(v1, v2);

    expect(diff.steps_removed).toHaveLength(1);
    expect(diff.steps_removed[0]?.step_id).toBe(step.step_id);
  });

  it('should detect modified steps', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const step = createStep('Original title');
    v1.steps.push(step);
    const v2 = createVersionFrom(v1);
    v2.steps[0]!.title = 'Modified title';

    const diff = computeDiff(v1, v2);

    expect(diff.steps_modified).toHaveLength(1);
    expect(diff.steps_modified[0]?.step_id).toBe(step.step_id);
    expect(diff.steps_modified[0]?.field_changes).toContainEqual({
      field: 'title',
      old_value: 'Original title',
      new_value: 'Modified title',
    });
  });

  it('should detect summary changes', () => {
    const v1 = createPlanVersion(planId, 'Original goal');
    const v2 = createVersionFrom(v1);
    v2.summary.goal = 'Modified goal';

    const diff = computeDiff(v1, v2);

    expect(diff.summary_changed).toBe(true);
  });

  it('should track dependency additions', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const step1 = createStep('Step 1');
    const step2 = createStep('Step 2');
    v1.steps.push(step1, step2);

    const v2 = createVersionFrom(v1);
    v2.steps[1]!.dependencies.push(step1.step_id);

    const diff = computeDiff(v1, v2);

    expect(diff.dependencies_added).toHaveLength(1);
    expect(diff.dependencies_added[0]).toEqual({
      from_step_id: step2.step_id,
      to_step_id: step1.step_id,
    });
  });

  it('should track dependency removals', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const step1 = createStep('Step 1');
    const step2 = createStep('Step 2', { dependencies: [step1.step_id] });
    v1.steps.push(step1, step2);

    const v2 = createVersionFrom(v1);
    v2.steps[1]!.dependencies = [];

    const diff = computeDiff(v1, v2);

    expect(diff.dependencies_removed).toHaveLength(1);
    expect(diff.dependencies_removed[0]).toEqual({
      from_step_id: step2.step_id,
      to_step_id: step1.step_id,
    });
  });

  it('should set correct version numbers', () => {
    const v1 = createPlanVersion(planId, 'Test goal');
    const v2 = createVersionFrom(v1);

    const diff = computeDiff(v1, v2);

    expect(diff.from_version).toBe(1);
    expect(diff.to_version).toBe(2);
  });
});

describe('toJsonPatch', () => {
  it('should generate add operations for new steps', () => {
    const diff: VersionDiff = {
      from_version: 1,
      to_version: 2,
      summary_changed: false,
      steps_added: [
        {
          step_id: 'step1',
          step: { step_id: 'step1', title: 'New step', dependencies: [] },
        },
      ],
      steps_removed: [],
      steps_modified: [],
      dependencies_added: [],
      dependencies_removed: [],
    };

    const patches = toJsonPatch(diff);

    expect(patches).toContainEqual({
      op: 'add',
      path: '/steps/-',
      value: { step_id: 'step1', title: 'New step', dependencies: [] },
    });
  });

  it('should generate remove operations for deleted steps', () => {
    const diff: VersionDiff = {
      from_version: 1,
      to_version: 2,
      summary_changed: false,
      steps_added: [],
      steps_removed: [
        {
          step_id: 'step1',
          step: { step_id: 'step1', title: 'Deleted step', dependencies: [] },
        },
      ],
      steps_modified: [],
      dependencies_added: [],
      dependencies_removed: [],
    };

    const patches = toJsonPatch(diff);

    expect(patches).toContainEqual({
      op: 'remove',
      path: '/steps/step1',
    });
  });

  it('should generate replace operations for modified fields', () => {
    const diff: VersionDiff = {
      from_version: 1,
      to_version: 2,
      summary_changed: false,
      steps_added: [],
      steps_removed: [],
      steps_modified: [
        {
          step_id: 'step1',
          field_changes: [
            { field: 'title', old_value: 'Old', new_value: 'New' },
          ],
        },
      ],
      dependencies_added: [],
      dependencies_removed: [],
    };

    const patches = toJsonPatch(diff);

    expect(patches).toContainEqual({
      op: 'replace',
      path: '/steps/step1/title',
      value: 'New',
    });
  });

  it('should return empty array for no changes', () => {
    const diff: VersionDiff = {
      from_version: 1,
      to_version: 2,
      summary_changed: false,
      steps_added: [],
      steps_removed: [],
      steps_modified: [],
      dependencies_added: [],
      dependencies_removed: [],
    };

    const patches = toJsonPatch(diff);

    expect(patches).toHaveLength(0);
  });
});
