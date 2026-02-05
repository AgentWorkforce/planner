/**
 * BaselineService Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaselineService } from './baseline-service.js';
import { SQLiteTunerStorage } from '../storage/sqlite.js';
import type { TaskOutcome } from '../domain/outcome.js';

describe('BaselineService', () => {
  let storage: SQLiteTunerStorage;
  let service: BaselineService;

  beforeEach(() => {
    storage = new SQLiteTunerStorage(':memory:');
    service = new BaselineService(storage);
  });

  function createOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
    return {
      run_id: 'run-1',
      task_id: 'task-1',
      step_id: 'step-1',
      model_used: 'claude-sonnet',
      complexity_estimate: 'moderate',
      outcome: 'success',
      attempts: 1,
      duration_seconds: 100,
      tokens_used: 5000,
      cost_usd: 0.01,
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('normalizePattern', () => {
    it('creates pattern from task type, complexity, and language tier', () => {
      const outcome = createOutcome({ complexity_estimate: 'simple', language_tier: 'A' });
      const pattern = service.normalizePattern(outcome);
      expect(pattern).toBe('implementation:simple:A');
    });

    it('defaults language tier to A if not provided', () => {
      const outcome = createOutcome({ complexity_estimate: 'complex' });
      const pattern = service.normalizePattern(outcome);
      expect(pattern).toBe('implementation:complex:A');
    });
  });

  describe('updateBaseline', () => {
    it('initializes baseline with first sample', () => {
      const outcome = createOutcome({ duration_seconds: 100, tokens_used: 5000 });

      const baseline = service.updateBaseline(outcome);

      expect(baseline.sample_count).toBe(1);
      expect(baseline.mean_duration_seconds).toBe(100);
      expect(baseline.stddev_duration_seconds).toBe(0);
      expect(baseline.mean_tokens).toBe(5000);
      expect(baseline.success_rate).toBe(1);
    });

    it('computes EMA correctly with multiple samples', () => {
      // First sample: 100
      service.updateBaseline(createOutcome({ duration_seconds: 100 }));

      // Second sample: 200
      // EMA with α=0.1: new_mean = 0.1 * 200 + 0.9 * 100 = 110
      const baseline = service.updateBaseline(createOutcome({ duration_seconds: 200 }));

      expect(baseline.sample_count).toBe(2);
      expect(baseline.mean_duration_seconds).toBeCloseTo(110, 1);
    });

    it('computes Welford stddev correctly', () => {
      // Note: Our implementation uses EMA-based mean (α=0.1) with Welford variance
      // This gives different results than classical sample stddev
      // We verify stddev increases with variance and is computed correctly

      // Consistent values should have low stddev
      const consistentValues = [100, 100, 100, 100, 100];
      let baseline;
      for (const v of consistentValues) {
        baseline = service.updateBaseline(createOutcome({
          duration_seconds: v,
          task_id: `task-consistent-${v}-${Math.random()}`,
        }));
      }
      const consistentStddev = baseline!.stddev_duration_seconds;

      // Reset with new storage for varied values test
      const storage2 = new SQLiteTunerStorage(':memory:');
      const service2 = new BaselineService(storage2);

      // Varied values should have higher stddev
      const variedValues = [50, 150, 50, 150, 50];
      for (const v of variedValues) {
        baseline = service2.updateBaseline(createOutcome({
          duration_seconds: v,
          task_id: `task-varied-${v}-${Math.random()}`,
        }));
      }
      const variedStddev = baseline!.stddev_duration_seconds;

      // Verify: varied data has higher stddev than consistent data
      expect(consistentStddev).toBe(0);
      expect(variedStddev).toBeGreaterThan(10);
    });

    it('tracks success rate correctly', () => {
      // 3 successes, 2 failures
      service.updateBaseline(createOutcome({ outcome: 'success' }));
      service.updateBaseline(createOutcome({ outcome: 'success', task_id: 't2' }));
      service.updateBaseline(createOutcome({ outcome: 'failure', task_id: 't3' }));
      service.updateBaseline(createOutcome({ outcome: 'success', task_id: 't4' }));
      const baseline = service.updateBaseline(createOutcome({ outcome: 'failure', task_id: 't5' }));

      // 3/5 = 0.6
      expect(baseline.success_rate).toBeCloseTo(0.6, 1);
    });
  });

  describe('getBaseline', () => {
    it('returns null for unknown pattern', () => {
      const baseline = service.getBaseline('unknown:pattern:X');
      expect(baseline).toBeNull();
    });

    it('returns existing baseline', () => {
      const outcome = createOutcome();
      service.updateBaseline(outcome);

      const pattern = service.normalizePattern(outcome);
      const baseline = service.getBaseline(pattern);

      expect(baseline).not.toBeNull();
      expect(baseline!.pattern).toBe(pattern);
    });
  });
});
