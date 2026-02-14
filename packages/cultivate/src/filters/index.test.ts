/**
 * Tests for unified applyFilters function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyFilters,
  FilterRuleRegistry,
  type FilterRuleFunction,
} from './index.js';
import { SignalFilteredError } from '../errors.js';
import type { NormalizedEvent } from '../domain/types.js';
import type { Greenhouse } from '../storage/index.js';
import type { CultivateConfig, CultivateStorage } from '../types.js';

describe('applyFilters', () => {
  let registry: FilterRuleRegistry;
  let signal: NormalizedEvent;
  let greenhouse: Greenhouse;
  let config: CultivateConfig;
  let storage: CultivateStorage;

  beforeEach(() => {
    // Create fresh registry for each test
    registry = new FilterRuleRegistry();

    // Sample signal
    signal = {
      title: 'Test Signal',
      body: 'This is a test signal about machine learning',
      author: 'test-author',
      author_type: 'human',
      source_type: 'github_issue',
      external_id: 'issue-123',
      occurred_at: new Date().toISOString(),
    };

    // Sample greenhouse
    greenhouse = {
      id: 'gh-1',
      name: 'Test Greenhouse',
      mode: 'discovery',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Sample config
    config = {
      weights: {},
      filter_rules: {},
      tier1_strictness: 0.5,
      tier2_threshold: 0.7,
    };

    // Mock storage (not used in current implementation but required by signature)
    storage = {} as CultivateStorage;
  });

  describe('Tier 0 (Greenhouse Gate)', () => {
    it('should reject signal missing required keyword at Tier 0', async () => {
      // Set required keyword that signal doesn't have
      greenhouse.keyword_require = ['python'];

      await expect(
        applyFilters(signal, greenhouse, config, storage, registry)
      ).rejects.toThrow(SignalFilteredError);

      try {
        await applyFilters(signal, greenhouse, config, storage, registry);
      } catch (err) {
        expect(err).toBeInstanceOf(SignalFilteredError);
        expect((err as SignalFilteredError).filter_tier).toBe(0);
        expect((err as SignalFilteredError).reason).toContain('Missing required keyword');
      }
    });

    it('should reject signal with excluded keyword at Tier 0', async () => {
      // Set excluded keyword that signal has
      greenhouse.keyword_exclude = ['test'];

      await expect(
        applyFilters(signal, greenhouse, config, storage, registry)
      ).rejects.toThrow(SignalFilteredError);

      try {
        await applyFilters(signal, greenhouse, config, storage, registry);
      } catch (err) {
        expect(err).toBeInstanceOf(SignalFilteredError);
        expect((err as SignalFilteredError).filter_tier).toBe(0);
        expect((err as SignalFilteredError).reason).toContain('Contains excluded keyword');
      }
    });

    it('should pass Tier 0 when signal has required keyword', async () => {
      greenhouse.keyword_require = ['machine'];

      const result = await applyFilters(signal, greenhouse, config, storage, registry);

      expect(result.passed).toBe(true);
    });

    it('should skip Tier 1 when Tier 0 rejects', async () => {
      // Set up rejection at Tier 0
      greenhouse.keyword_require = ['nonexistent'];

      // Register a boost rule at Tier 1 (should not execute)
      const boostRule: FilterRuleFunction = () => ({
        action: 'boost',
        score_adjustment: 10,
      });
      registry.register('boost-rule', 'Boost Rule', 'Boosts score', 'boost', boostRule);
      config.filter_rules['boost-rule'] = { enabled: true };

      // Tier 0 should reject before Tier 1 runs
      await expect(
        applyFilters(signal, greenhouse, config, storage, registry)
      ).rejects.toThrow(SignalFilteredError);

      try {
        await applyFilters(signal, greenhouse, config, storage, registry);
      } catch (err) {
        // Should be Tier 0 rejection, not Tier 1
        expect((err as SignalFilteredError).filter_tier).toBe(0);
      }
    });
  });

  describe('Tier 1 (Rule Registry)', () => {
    it('should reject signal at Tier 1 when rule rejects', async () => {
      // Register reject rule
      const rejectRule: FilterRuleFunction = () => ({
        action: 'reject',
        reason: 'Signal is noise',
      });
      registry.register('noise-reject', 'Noise Reject', 'Rejects noise', 'reject', rejectRule);
      config.filter_rules['noise-reject'] = { enabled: true };

      await expect(
        applyFilters(signal, greenhouse, config, storage, registry)
      ).rejects.toThrow(SignalFilteredError);

      try {
        await applyFilters(signal, greenhouse, config, storage, registry);
      } catch (err) {
        expect(err).toBeInstanceOf(SignalFilteredError);
        expect((err as SignalFilteredError).filter_tier).toBe(1);
        expect((err as SignalFilteredError).reason).toContain('Signal is noise');
      }
    });

    it('should accumulate score adjustments from boost rules', async () => {
      // Register multiple boost rules
      const boost1: FilterRuleFunction = () => ({
        action: 'boost',
        score_adjustment: 5,
      });
      const boost2: FilterRuleFunction = () => ({
        action: 'boost',
        score_adjustment: 10,
      });

      registry.register('boost-1', 'Boost 1', 'First boost', 'boost', boost1);
      registry.register('boost-2', 'Boost 2', 'Second boost', 'boost', boost2);

      config.filter_rules['boost-1'] = { enabled: true };
      config.filter_rules['boost-2'] = { enabled: true };

      const result = await applyFilters(signal, greenhouse, config, storage, registry);

      expect(result.passed).toBe(true);
      expect(result.score_adjustments).toBe(15); // 5 + 10
    });

    it('should pass with zero score adjustments when no boost rules', async () => {
      const result = await applyFilters(signal, greenhouse, config, storage, registry);

      expect(result.passed).toBe(true);
      expect(result.score_adjustments).toBe(0);
    });
  });

  describe('Integration', () => {
    it('should pass both tiers and return accumulated score adjustments', async () => {
      // Set up passing Tier 0
      greenhouse.keyword_require = ['machine'];

      // Set up boost rules in Tier 1
      const boost: FilterRuleFunction = () => ({
        action: 'boost',
        score_adjustment: 7,
      });
      registry.register('ml-boost', 'ML Boost', 'Boosts ML signals', 'boost', boost);
      config.filter_rules['ml-boost'] = { enabled: true };

      const result = await applyFilters(signal, greenhouse, config, storage, registry);

      expect(result.passed).toBe(true);
      expect(result.score_adjustments).toBe(7);
    });

    it('should only run enabled rules', async () => {
      // Register rules but don't enable them
      const boost: FilterRuleFunction = () => ({
        action: 'boost',
        score_adjustment: 100,
      });
      registry.register('disabled-boost', 'Disabled Boost', 'Should not run', 'boost', boost);
      config.filter_rules['disabled-boost'] = { enabled: false };

      const result = await applyFilters(signal, greenhouse, config, storage, registry);

      expect(result.passed).toBe(true);
      expect(result.score_adjustments).toBe(0); // Disabled rule didn't run
    });
  });
});
