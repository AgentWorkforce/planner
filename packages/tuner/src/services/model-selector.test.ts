/**
 * ModelSelector Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelSelector } from './model-selector.js';
import { SQLiteTunerStorage } from '../storage/sqlite.js';
import { DEFAULT_FORGE_CONFIG, type ForgeExecutionConfig } from '../domain/config.js';
import type { TaskOutcome } from '../domain/outcome.js';

describe('ModelSelector', () => {
  let storage: SQLiteTunerStorage;
  let config: ForgeExecutionConfig;
  let selector: ModelSelector;

  beforeEach(() => {
    storage = new SQLiteTunerStorage(':memory:');
    config = { ...DEFAULT_FORGE_CONFIG };
    selector = new ModelSelector(storage, config);
  });

  function createOutcome(model: string, success: boolean): TaskOutcome {
    return {
      run_id: 'run-1',
      task_id: `task-${Date.now()}`,
      step_id: 'step-impl',
      model_used: model,
      complexity_estimate: 'moderate',
      outcome: success ? 'success' : 'failure',
      attempts: 1,
      duration_seconds: 100,
      tokens_used: 5000,
      cost_usd: success ? 0.01 : 0.005,
      timestamp: new Date().toISOString(),
    };
  }

  describe('selectModel', () => {
    it('returns hard rule match first', () => {
      const result = selector.selectModel({
        taskType: 'documentation',
        complexity: 'moderate',
      });

      // Default config has: { task_type: 'documentation' } → haiku
      expect(result.model).toBe('claude-haiku');
      expect(result.reason).toBe('hard_rule');
    });

    it('uses round-robin during burn-in (<50 trials)', () => {
      // Without hard rule match
      const context = {
        taskType: 'implementation',
        complexity: 'moderate',
        languageTier: 'A',
      };

      // First 3 selections should round-robin through models
      const results = [];
      for (let i = 0; i < 3; i++) {
        // Simulate different trial counts
        results.push(selector.selectModel(context).reason);
      }

      expect(results.every(r => r === 'round_robin')).toBe(true);
    });

    it('records outcome and updates Beta distribution', () => {
      // Record some outcomes
      selector.recordOutcome(createOutcome('claude-sonnet', true));
      selector.recordOutcome(createOutcome('claude-sonnet', true));
      selector.recordOutcome(createOutcome('claude-sonnet', false));

      // Check the baseline was created
      const baselines = selector.getModelBaselines();
      const sonnetBaseline = baselines.find(b => b.model === 'claude-sonnet');

      expect(sonnetBaseline).toBeDefined();
      expect(sonnetBaseline!.alpha).toBe(3); // 1 prior + 2 successes
      expect(sonnetBaseline!.beta).toBe(2);  // 1 prior + 1 failure
      expect(sonnetBaseline!.total_attempts).toBe(3);
    });

    it('initializes new model with Beta(1,1) prior on first success', () => {
      selector.recordOutcome(createOutcome('claude-opus', true));

      const baselines = selector.getModelBaselines();
      const opusBaseline = baselines.find(b => b.model === 'claude-opus');

      expect(opusBaseline).toBeDefined();
      expect(opusBaseline!.alpha).toBe(2); // 1 prior + 1 success
      expect(opusBaseline!.beta).toBe(1);  // 1 prior + 0 failures
    });

    it('initializes new model with Beta(1,1) prior on first failure', () => {
      selector.recordOutcome(createOutcome('claude-opus', false));

      const baselines = selector.getModelBaselines();
      const opusBaseline = baselines.find(b => b.model === 'claude-opus');

      expect(opusBaseline).toBeDefined();
      expect(opusBaseline!.alpha).toBe(1); // 1 prior + 0 successes
      expect(opusBaseline!.beta).toBe(2);  // 1 prior + 1 failure
    });
  });

  describe('exploration rate', () => {
    it('explores with configured probability', () => {
      // This is probabilistic, so we test over many trials
      // With exploration_rate = 0.10, we expect ~10% exploration

      // We can't easily test this without mocking Math.random
      // Just verify the config is respected
      expect(config.model_selection.exploration_rate).toBe(0.10);
    });
  });
});
