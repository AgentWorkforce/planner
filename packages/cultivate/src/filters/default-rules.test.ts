/**
 * Tests for default filter rules
 *
 * Validates acceptance criteria for all 6 default rules:
 * - noise_reject: rejects 'hi' (< 20 chars)
 * - bot_reject: rejects signals from author_type='bot'
 * - length_check: rejects based on strictness
 * - specificity_boost: gives +0.1 for URLs or code
 * - structure_boost: gives +0.05 for structured formatting
 * - question_boost: gives +0.1 for questions
 */

import { describe, it, expect } from 'vitest';
import { FilterRuleRegistry } from './rule-registry.js';
import { registerDefaultRules } from './default-rules.js';
import type { NormalizedEvent } from '../domain/types.js';

describe('default-rules', () => {
  describe('registerDefaultRules', () => {
    it('registers all 6 default rules', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const rules = registry.list();
      expect(rules).toHaveLength(6);

      const ruleIds = rules.map(r => r.id);
      expect(ruleIds).toContain('noise_reject');
      expect(ruleIds).toContain('bot_reject');
      expect(ruleIds).toContain('length_check');
      expect(ruleIds).toContain('specificity_boost');
      expect(ruleIds).toContain('structure_boost');
      expect(ruleIds).toContain('question_boost');
    });
  });

  describe('noise_reject', () => {
    it('rejects signals with title+body < 20 chars (e.g., "hi")', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: '',
        body: 'hi',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-1',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['noise_reject'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(false);
      expect(result.rejection_rule).toBe('Noise Rejection');
      expect(result.rejection_reason).toContain('too short');
    });

    it('passes signals with title+body >= 20 chars', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Valid Title',
        body: 'This is a valid signal with enough content',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-2',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['noise_reject'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
    });
  });

  describe('bot_reject', () => {
    it('rejects signals from author_type="bot"', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Bot Message',
        body: 'This is an automated message from a bot',
        author: 'bot-user',
        author_type: 'bot',
        source_type: 'webhook',
        external_id: 'test-3',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['bot_reject'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(false);
      expect(result.rejection_rule).toBe('Bot Rejection');
      expect(result.rejection_reason).toBe('Signal from bot author');
    });

    it('passes signals from human users', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Human Message',
        body: 'This is a message from a real user',
        author: 'human-user',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-4',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['bot_reject'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
    });
  });

  describe('length_check', () => {
    it('rejects short body when strictness is high', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Short',
        body: 'Too brief', // 9 chars, needs 100+ for strictness 0.8
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-5',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['length_check'], { tier1_strictness: 0.8 });

      expect(result.passed).toBe(false);
      expect(result.rejection_reason).toContain('Body too short');
      expect(result.rejection_reason).toContain('minimum 100');
    });

    it('passes adequate body length for strictness level', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Valid',
        body: 'This is a signal with enough content to pass the length check for medium strictness level',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-6',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['length_check'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
    });
  });

  describe('specificity_boost', () => {
    it('gives +0.1 for signals with URLs', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Check this out',
        body: 'Found a great resource at https://example.com/article',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-7',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['specificity_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.1);
    });

    it('gives +0.1 for signals with code snippets', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Code issue',
        body: 'The function `getValue()` is not working correctly',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-8',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['specificity_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.1);
    });

    it('gives +0.1 for signals with technical terms', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'API Bug',
        body: 'The API endpoint is returning an error',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-9',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['specificity_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.1);
    });

    it('passes without boost for generic content', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'General feedback',
        body: 'I think this could be better somehow',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-10',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['specificity_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0);
    });
  });

  describe('structure_boost', () => {
    it('gives +0.05 for bullet points', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Feature list',
        body: 'We need:\n- Feature A\n- Feature B\n- Feature C',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-11',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['structure_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.05);
    });

    it('gives +0.05 for numbered lists', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Steps',
        body: 'Process:\n1. First step\n2. Second step\n3. Third step',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-12',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['structure_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.05);
    });

    it('gives +0.05 for markdown headers', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Documentation',
        body: '## Overview\nThis section describes the feature\n### Details\nMore info here',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-13',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['structure_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.05);
    });
  });

  describe('question_boost', () => {
    it('gives +0.1 for signals containing "?"', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Question',
        body: 'How do we implement this feature?',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-14',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['question_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.1);
    });

    it('gives +0.1 for question phrases', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Inquiry',
        body: 'I was wondering how to set this up correctly',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-15',
        occurred_at: new Date().toISOString(),
      };

      const result = registry.execute(signal, ['question_boost'], { tier1_strictness: 0.5 });

      expect(result.passed).toBe(true);
      expect(result.score_adjustment).toBe(0.1);
    });
  });

  describe('combined rules', () => {
    it('accumulates boost scores from multiple rules', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: 'Technical Question',
        body: 'How do we fix the API bug?\n- Check the endpoint\n- Review the code',
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-16',
        occurred_at: new Date().toISOString(),
      };

      // Enable all boost rules
      const result = registry.execute(
        signal,
        ['specificity_boost', 'structure_boost', 'question_boost'],
        { tier1_strictness: 0.5 }
      );

      expect(result.passed).toBe(true);
      // specificity (+0.1) + structure (+0.05) + question (+0.1) = +0.25
      expect(result.score_adjustment).toBe(0.25);
    });

    it('short-circuits on first rejection', () => {
      const registry = new FilterRuleRegistry();
      registerDefaultRules(registry);

      const signal: NormalizedEvent = {
        title: '',
        body: 'hi', // Too short
        author: 'user1',
        author_type: 'user',
        source_type: 'poll_api',
        external_id: 'test-17',
        occurred_at: new Date().toISOString(),
      };

      // Enable rejection rules - should reject on noise_reject
      const result = registry.execute(
        signal,
        ['noise_reject', 'bot_reject', 'length_check'],
        { tier1_strictness: 0.5 }
      );

      expect(result.passed).toBe(false);
      expect(result.rejection_rule).toBe('Noise Rejection');
      expect(result.score_adjustment).toBe(0);
    });
  });
});
