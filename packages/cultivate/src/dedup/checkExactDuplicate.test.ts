/**
 * Tests for exact duplicate detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteCultivateStorage } from '../storage/sqlite.js';
import { checkExactDuplicate } from './checkExactDuplicate.js';
import type { CreateSignalInput } from '../storage/interface.js';

describe('checkExactDuplicate', () => {
  let storage: SqliteCultivateStorage;

  beforeEach(() => {
    storage = new SqliteCultivateStorage(':memory:');
  });

  it('returns null when no duplicate exists', async () => {
    const result = await checkExactDuplicate('slack', 'msg-12345', storage);
    expect(result).toBeNull();
  });

  it('returns the signal ID when an exact duplicate exists', async () => {
    // Create a greenhouse first
    const greenhouse = await storage.createGreenhouse({
      name: 'Test Greenhouse',
      mode: 'discovery',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
    });

    // Create first signal
    const signal1Input: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'slack',
      external_id: 'msg-12345',
      title: 'Test Signal',
      body: 'Test body',
      author: 'test@example.com',
      author_type: 'user',
      score: 0.5,
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
      status: 'pending',
    };

    const signal1 = await storage.createSignal(signal1Input);

    // Check for duplicate using same source_type and external_id
    const duplicateId = await checkExactDuplicate('slack', 'msg-12345', storage);

    expect(duplicateId).toBe(signal1.id);
  });

  it('returns null when external_id differs but source_type is same', async () => {
    // Create a greenhouse
    const greenhouse = await storage.createGreenhouse({
      name: 'Test Greenhouse',
      mode: 'discovery',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
    });

    // Create signal with one external_id
    const signal1Input: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'slack',
      external_id: 'msg-12345',
      title: 'Test Signal',
      body: 'Test body',
      author: 'test@example.com',
      author_type: 'user',
      score: 0.5,
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
      status: 'pending',
    };

    await storage.createSignal(signal1Input);

    // Check for duplicate with different external_id
    const result = await checkExactDuplicate('slack', 'msg-54321', storage);

    expect(result).toBeNull();
  });

  it('returns null when source_type differs but external_id is same', async () => {
    // Create a greenhouse
    const greenhouse = await storage.createGreenhouse({
      name: 'Test Greenhouse',
      mode: 'discovery',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
    });

    // Create signal with one source_type
    const signal1Input: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'slack',
      external_id: 'msg-12345',
      title: 'Test Signal',
      body: 'Test body',
      author: 'test@example.com',
      author_type: 'user',
      score: 0.5,
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
      status: 'pending',
    };

    await storage.createSignal(signal1Input);

    // Check for duplicate with different source_type
    const result = await checkExactDuplicate('twitter', 'msg-12345', storage);

    expect(result).toBeNull();
  });

  it('enforces unique constraint on (source_type, external_id) at database level', async () => {
    // Create a greenhouse
    const greenhouse = await storage.createGreenhouse({
      name: 'Test Greenhouse',
      mode: 'discovery',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
    });

    // Create first signal
    const signalInput: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'slack',
      external_id: 'msg-12345',
      title: 'Test Signal',
      body: 'Test body',
      author: 'test@example.com',
      author_type: 'user',
      score: 0.5,
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
      status: 'pending',
    };

    await storage.createSignal(signalInput);

    // Try to create another signal with same source_type and external_id
    const duplicateInput: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'slack',
      external_id: 'msg-12345',
      title: 'Duplicate Signal',
      body: 'Different body',
      author: 'other@example.com',
      author_type: 'user',
      score: 0.8,
      scoring_factors: {
        recency: 0.8,
        specificity: 0.8,
        source_authority: 0.8,
        repetition: 0.8,
        emotional_intensity: 0.8,
        strategic_fit: 0.8,
        actionability: 0.8,
        content_quality: 0.8,
      },
      status: 'pending',
    };

    // Should throw due to unique constraint violation
    await expect(storage.createSignal(duplicateInput)).rejects.toThrow();
  });

  it('handles multiple signals with same external_id but different source_types', async () => {
    // Create a greenhouse
    const greenhouse = await storage.createGreenhouse({
      name: 'Test Greenhouse',
      mode: 'discovery',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
    });

    // Create signal from slack
    const slackSignalInput: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'slack',
      external_id: 'msg-12345',
      title: 'Slack Signal',
      body: 'Test body',
      author: 'test@example.com',
      author_type: 'user',
      score: 0.5,
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
      status: 'pending',
    };

    const slackSignal = await storage.createSignal(slackSignalInput);

    // Create signal from twitter with same external_id
    const twitterSignalInput: CreateSignalInput = {
      greenhouse_id: greenhouse.id,
      source_type: 'twitter',
      external_id: 'msg-12345',
      title: 'Twitter Signal',
      body: 'Test body',
      author: 'other@example.com',
      author_type: 'user',
      score: 0.6,
      scoring_factors: {
        recency: 0.6,
        specificity: 0.6,
        source_authority: 0.6,
        repetition: 0.6,
        emotional_intensity: 0.6,
        strategic_fit: 0.6,
        actionability: 0.6,
        content_quality: 0.6,
      },
      status: 'pending',
    };

    const twitterSignal = await storage.createSignal(twitterSignalInput);

    // Check for slack duplicate
    const slackDuplicate = await checkExactDuplicate('slack', 'msg-12345', storage);
    expect(slackDuplicate).toBe(slackSignal.id);

    // Check for twitter duplicate
    const twitterDuplicate = await checkExactDuplicate('twitter', 'msg-12345', storage);
    expect(twitterDuplicate).toBe(twitterSignal.id);

    // Ensure they don't cross-match
    expect(slackDuplicate).not.toBe(twitterDuplicate);
  });
});
