/**
 * Tests for ModelSelector override behavior.
 *
 * Covers:
 * - task.model_override short-circuits all other routing logic
 * - Override works for all three model values (haiku, sonnet, opus)
 * - Override wins over architecture role detection
 * - Override wins over complexity score routing
 * - Without override, normal complexity-based routing is preserved
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelSelector } from '../model-selector.js';
import { createTask, type ForgeStep } from '../../domain/types.js';

// ============================================
// Shared fixtures
// ============================================

const RUN_ID = crypto.randomUUID();

/** Minimal step used to construct tasks for testing. */
const minimalStep: ForgeStep = {
  step_id: 'test-1',
  title: 'Test Step',
  dependencies: [],
};

/** Step whose title triggers architecture detection. */
const architectureStep: ForgeStep = {
  step_id: 'arch-1',
  title: 'Design system architecture',
  dependencies: [],
};

/** Step whose title suggests a trivial task. */
const trivialStep: ForgeStep = {
  step_id: 'trivial-1',
  title: 'Update docs',
  dependencies: [],
};

// ============================================
// Override — haiku
// ============================================

describe('ModelSelector.selectModelForTask() with model_override', () => {
  let selector: ModelSelector;

  beforeEach(() => {
    selector = new ModelSelector();
  });

  it('returns haiku when model_override is haiku, regardless of complexity', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'haiku';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.95, // would normally route to opus
    });

    expect(result.model).toBe('haiku');
    expect(result.reason).toMatch(/override/i);
  });

  it('returns sonnet when model_override is sonnet', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'sonnet';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.1, // would normally route to haiku
    });

    expect(result.model).toBe('sonnet');
    expect(result.reason).toMatch(/override/i);
  });

  it('returns opus when model_override is opus, even for a trivial task', () => {
    const task = createTask(RUN_ID, trivialStep, '/tmp/workspace');
    task.model_override = 'opus';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.05, // would normally route to haiku
    });

    expect(result.model).toBe('opus');
    expect(result.reason).toMatch(/override/i);
  });

  // ============================================
  // Override wins over architecture detection
  // ============================================

  it('override takes precedence over architecture role detection', () => {
    const task = createTask(RUN_ID, architectureStep, '/tmp/workspace');
    task.model_override = 'haiku';

    // Without override, architecture title would route to opus
    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      stepRole: 'architect',
    });

    expect(result.model).toBe('haiku');
    expect(result.reason).toMatch(/override/i);
    expect(result.complexityCategory).toBe('override');
  });

  it('override takes precedence over stepRole-based architecture detection', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'sonnet';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      stepRole: 'system architect',
    });

    expect(result.model).toBe('sonnet');
    expect(result.reason).toMatch(/override/i);
  });

  // ============================================
  // Override wins over complexity routing
  // ============================================

  it('override wins over high complexity score that would select opus', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'haiku';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 1.0,
    });

    expect(result.model).toBe('haiku');
  });

  it('override wins over low complexity score that would select haiku', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'opus';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.0,
    });

    expect(result.model).toBe('opus');
  });

  // ============================================
  // No override — normal routing is preserved
  // ============================================

  it('routes to opus when architecture title is detected and no override is set', () => {
    const task = createTask(RUN_ID, architectureStep, '/tmp/workspace');
    // model_override intentionally left unset

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
    });

    expect(result.model).toBe('opus');
    expect(result.reason).toMatch(/architecture/i);
  });

  it('uses complexity-based routing when no override is set', () => {
    const task = createTask(RUN_ID, trivialStep, '/tmp/workspace');
    // model_override intentionally left unset

    const lowComplexityResult = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.1,
    });

    const highComplexityResult = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.9,
    });

    // Low complexity should not select opus; high complexity should not select haiku
    expect(lowComplexityResult.model).not.toBe('opus');
    expect(highComplexityResult.model).not.toBe('haiku');
  });

  it('falls back to default model when no override and no complexity score', () => {
    const task = createTask(RUN_ID, trivialStep, '/tmp/workspace');

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
    });

    // Default is 'sonnet' per ModelSelector constructor
    expect(result.model).toBe('sonnet');
  });

  // ============================================
  // Override result shape
  // ============================================

  it('sets complexityCategory to "override" in the result', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'haiku';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
      complexityScore: 0.5,
    });

    expect(result.complexityCategory).toBe('override');
  });

  it('does not set matchedRule when override is used', () => {
    const task = createTask(RUN_ID, minimalStep, '/tmp/workspace');
    task.model_override = 'sonnet';

    const result = selector.selectModelForTask({
      task,
      runId: RUN_ID,
    });

    expect(result.matchedRule).toBeUndefined();
  });
});

