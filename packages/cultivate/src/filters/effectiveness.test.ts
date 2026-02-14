/**
 * Tests for filter rule effectiveness tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteCultivateStorage } from '../storage/sqlite.js';
import { updateRuleEffectiveness, recalculateFalsePositiveRate } from './effectiveness.js';

describe('Filter Rule Effectiveness', () => {
  let storage: SqliteCultivateStorage;

  beforeEach(async () => {
    // Create in-memory database for testing
    storage = new SqliteCultivateStorage(':memory:');
  });

  describe('updateRuleEffectiveness', () => {
    it('should increment signals_matched count when matched=true', async () => {
      // Create a test filter rule
      const rule = await storage.createFilterRule({
        name: 'Test Rule',
        description: 'Test description',
        type: 'reject',
        condition: 'body.length < 10',
        enabled: true,
      });

      // Verify initial state
      expect(rule.effectiveness.signals_matched).toBe(0);
      expect(rule.effectiveness.false_positive_rate).toBe(0);

      // Update effectiveness (matched=true)
      await updateRuleEffectiveness(storage, rule.id, true);

      // Verify signals_matched incremented
      const updated = await storage.getFilterRuleById(rule.id);
      expect(updated?.effectiveness.signals_matched).toBe(1);
      expect(updated?.effectiveness.false_positive_rate).toBe(0);

      // Update again
      await updateRuleEffectiveness(storage, rule.id, true);

      // Verify count incremented again
      const updated2 = await storage.getFilterRuleById(rule.id);
      expect(updated2?.effectiveness.signals_matched).toBe(2);
    });

    it('should not increment signals_matched when matched=false', async () => {
      // Create a test filter rule
      const rule = await storage.createFilterRule({
        name: 'Test Rule',
        description: 'Test description',
        type: 'reject',
        condition: 'body.length < 10',
        enabled: true,
      });

      // Update effectiveness (matched=false)
      await updateRuleEffectiveness(storage, rule.id, false);

      // Verify signals_matched not incremented
      const updated = await storage.getFilterRuleById(rule.id);
      expect(updated?.effectiveness.signals_matched).toBe(0);
    });

    it('should handle non-existent rule gracefully', async () => {
      // Should not throw, just log warning
      await expect(
        updateRuleEffectiveness(storage, 'non-existent-rule-id', true)
      ).resolves.not.toThrow();
    });
  });

  describe('recalculateFalsePositiveRate', () => {
    it('should return 0 when no signals have been rejected', async () => {
      // Create a test filter rule
      const rule = await storage.createFilterRule({
        name: 'Test Rule',
        description: 'Test description',
        type: 'reject',
        condition: 'body.length < 10',
        enabled: true,
      });

      // Recalculate FPR with no rejected signals
      const fpr = await recalculateFalsePositiveRate(storage, rule.id);
      expect(fpr).toBe(0);
    });

    it('should calculate false positive rate from rejected signal outcomes', async () => {
      // Create a test greenhouse and filter rule
      const greenhouse = await storage.createGreenhouse({
        name: 'Test Greenhouse',
        mode: 'discovery',
        keyword_require: [],
        keyword_exclude: [],
        source_ids: [],
      });

      const rule = await storage.createFilterRule({
        name: 'Test Rule',
        description: 'Test description',
        type: 'reject',
        condition: 'body.length < 10',
        enabled: true,
      });

      // Create 5 filtered signals, 3 rejected by this rule
      // 2 of those 3 have linked_plan_id (false positives)

      // Signal 1: Rejected by this rule, later linked to plan (false positive)
      const signal1 = await storage.createSignal({
        greenhouse_id: greenhouse.id,
        source_type: 'webhook',
        external_id: 'test-1',
        title: 'Test Signal 1',
        body: 'Test body',
        author: 'test@example.com',
        author_type: 'user',
        score: 0,
        scoring_factors: {
          recency: 0.5,
          specificity: 0.5,
          source_authority: 0.5,
          repetition: 0.5,
          emotional_intensity: 0.5,
          strategic_fit: 0.5,
          actionability: 0.5,
          content_quality: 0.5,
        },
        status: 'filtered',
        tags: [],
      });
      await storage.updateSignal(signal1.id, {
        linked_plan_id: 'plan-123',
        provenance: [{
          step: 'filter',
          timestamp: new Date().toISOString(),
          details: { rejection_rule: rule.id, reason: 'Too short' },
        }],
      });

      // Signal 2: Rejected by this rule, later linked to plan (false positive)
      const signal2 = await storage.createSignal({
        greenhouse_id: greenhouse.id,
        source_type: 'webhook',
        external_id: 'test-2',
        title: 'Test Signal 2',
        body: 'Test body',
        author: 'test@example.com',
        author_type: 'user',
        score: 0,
        scoring_factors: {
          recency: 0.5,
          specificity: 0.5,
          source_authority: 0.5,
          repetition: 0.5,
          emotional_intensity: 0.5,
          strategic_fit: 0.5,
          actionability: 0.5,
          content_quality: 0.5,
        },
        status: 'filtered',
        tags: [],
      });
      await storage.updateSignal(signal2.id, {
        linked_plan_id: 'plan-456',
        provenance: [{
          step: 'filter',
          timestamp: new Date().toISOString(),
          details: { rejection_rule: rule.id, reason: 'Too short' },
        }],
      });

      // Signal 3: Rejected by this rule, NOT linked (true negative)
      const signal3 = await storage.createSignal({
        greenhouse_id: greenhouse.id,
        source_type: 'webhook',
        external_id: 'test-3',
        title: 'Test Signal 3',
        body: 'Test body',
        author: 'test@example.com',
        author_type: 'user',
        score: 0,
        scoring_factors: {
          recency: 0.5,
          specificity: 0.5,
          source_authority: 0.5,
          repetition: 0.5,
          emotional_intensity: 0.5,
          strategic_fit: 0.5,
          actionability: 0.5,
          content_quality: 0.5,
        },
        status: 'filtered',
        tags: [],
      });
      await storage.updateSignal(signal3.id, {
        provenance: [{
          step: 'filter',
          timestamp: new Date().toISOString(),
          details: { rejection_rule: rule.id, reason: 'Too short' },
        }],
      });

      // Signal 4: Filtered but rejected by a DIFFERENT rule (should not count)
      const signal4 = await storage.createSignal({
        greenhouse_id: greenhouse.id,
        source_type: 'webhook',
        external_id: 'test-4',
        title: 'Test Signal 4',
        body: 'Test body',
        author: 'test@example.com',
        author_type: 'user',
        score: 0,
        scoring_factors: {
          recency: 0.5,
          specificity: 0.5,
          source_authority: 0.5,
          repetition: 0.5,
          emotional_intensity: 0.5,
          strategic_fit: 0.5,
          actionability: 0.5,
          content_quality: 0.5,
        },
        status: 'filtered',
        tags: [],
      });
      await storage.updateSignal(signal4.id, {
        provenance: [{
          step: 'filter',
          timestamp: new Date().toISOString(),
          details: { rejection_rule: 'other-rule-id', reason: 'Different reason' },
        }],
      });

      // Calculate false positive rate
      // 3 signals rejected by this rule, 2 have linked_plan_id
      // FPR = 2/3 = 0.6666...
      const fpr = await recalculateFalsePositiveRate(storage, rule.id);
      expect(fpr).toBeCloseTo(2/3, 4);

      // Verify the rule's effectiveness was updated
      const updatedRule = await storage.getFilterRuleById(rule.id);
      expect(updatedRule?.effectiveness.false_positive_rate).toBeCloseTo(2/3, 4);
    });

    it('should handle non-existent rule gracefully', async () => {
      // Should return 0 and log warning
      const fpr = await recalculateFalsePositiveRate(storage, 'non-existent-rule-id');
      expect(fpr).toBe(0);
    });
  });
});
