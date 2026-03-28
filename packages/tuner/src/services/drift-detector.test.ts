/**
 * DriftDetector Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DriftDetector } from './drift-detector.js';
import { BaselineService } from './baseline-service.js';
import { SQLiteTunerStorage } from '../storage/sqlite.js';
import type { TaskOutcome } from '../domain/outcome.js';

describe('DriftDetector', () => {
  let storage: SQLiteTunerStorage;
  let baseline: BaselineService;
  let drift: DriftDetector;

  beforeEach(() => {
    storage = new SQLiteTunerStorage(':memory:');
    baseline = new BaselineService(storage);
    drift = new DriftDetector(storage, baseline);
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

  describe('checkDrift', () => {
    it('returns empty if sample_count < 30', () => {
      // Add 10 samples (not enough for drift detection)
      for (let i = 0; i < 10; i++) {
        baseline.updateBaseline(createOutcome({ task_id: `task-${i}` }));
      }

      // Check drift on new outcome
      const alerts = drift.checkDrift(createOutcome({ duration_seconds: 1000 }));

      expect(alerts).toHaveLength(0);
    });

    it('generates warning at 2σ deviation', () => {
      // Create baseline with enough samples
      // All samples at duration=100, stddev will be small
      for (let i = 0; i < 35; i++) {
        baseline.updateBaseline(createOutcome({
          task_id: `task-${i}`,
          duration_seconds: 100 + (i % 2 === 0 ? 5 : -5), // 95-105 range
        }));
      }

      // Get baseline to check stddev
      const bl = baseline.getBaseline(baseline.normalizePattern(createOutcome()));
      expect(bl!.sample_count).toBeGreaterThanOrEqual(30);

      // Now trigger a 2σ deviation (significantly higher than baseline)
      const outlier = createOutcome({
        task_id: 'outlier',
        duration_seconds: bl!.mean_duration_seconds + (2.5 * bl!.stddev_duration_seconds),
      });

      const alerts = drift.checkDrift(outlier);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('warning');
    });

    it('generates critical at 3σ deviation', () => {
      // Create baseline with consistent samples
      for (let i = 0; i < 35; i++) {
        baseline.updateBaseline(createOutcome({
          task_id: `task-${i}`,
          duration_seconds: 100 + (i % 3 - 1) * 5, // 95, 100, 105
        }));
      }

      const bl = baseline.getBaseline(baseline.normalizePattern(createOutcome()));

      // Trigger 3σ+ deviation
      const outlier = createOutcome({
        task_id: 'outlier',
        duration_seconds: bl!.mean_duration_seconds + (4 * bl!.stddev_duration_seconds),
      });

      const alerts = drift.checkDrift(outlier);

      const criticalAlert = alerts.find(a => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
    });

    it('does not alert when within 1σ', () => {
      // Create baseline
      for (let i = 0; i < 35; i++) {
        baseline.updateBaseline(createOutcome({
          task_id: `task-${i}`,
          duration_seconds: 100 + (i % 2 === 0 ? 10 : -10),
        }));
      }

      const bl = baseline.getBaseline(baseline.normalizePattern(createOutcome()));

      // Value within 1σ - should not alert
      const normal = createOutcome({
        task_id: 'normal',
        duration_seconds: bl!.mean_duration_seconds + (0.5 * bl!.stddev_duration_seconds),
      });

      const alerts = drift.checkDrift(normal);

      expect(alerts).toHaveLength(0);
    });

    it('handles zero stddev gracefully', () => {
      // All identical samples - stddev will be 0
      for (let i = 0; i < 35; i++) {
        baseline.updateBaseline(createOutcome({
          task_id: `task-${i}`,
          duration_seconds: 100, // All same
          tokens_used: 5000,     // All same
        }));
      }

      // Even with stddev=0, this shouldn't crash
      const outlier = createOutcome({
        task_id: 'outlier',
        duration_seconds: 200,
      });

      const alerts = drift.checkDrift(outlier);

      // No alerts because we can't calculate sigma with stddev=0
      expect(alerts).toHaveLength(0);
    });
  });
});
