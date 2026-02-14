/**
 * Tests for SQLite Cultivate Storage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteCultivateStorage } from './sqlite.js';
import type { CreateSignalInput } from './interface.js';

describe('SqliteCultivateStorage', () => {
  let storage: SqliteCultivateStorage;

  beforeEach(() => {
    // Create in-memory database for testing
    storage = new SqliteCultivateStorage(':memory:');
  });

  describe('checkExactDuplicate', () => {
    it('should return null when no signal exists with the source_type and external_id', async () => {
      const result = await storage.checkExactDuplicate('slack', 'msg-12345');
      expect(result).toBeNull();
    });

    it('should return the signal ID when a duplicate signal exists', async () => {
      // Create a signal
      const input: CreateSignalInput = {
        greenhouse_id: 'gh-1',
        source_type: 'slack',
        external_id: 'msg-12345',
        title: 'Test Signal',
        body: 'Test body',
        author: 'Test Author',
        author_type: 'user',
        score: 0.5,
        scoring_factors: { relevance: 0.5 },
        status: 'pending',
        tags: [],
      };

      const created = await storage.createSignal(input);

      // Check for exact duplicate
      const duplicateId = await storage.checkExactDuplicate('slack', 'msg-12345');
      expect(duplicateId).toBe(created.id);
    });

    it('should detect duplicates across different greenhouses', async () => {
      // Create a signal in greenhouse 1
      const input1: CreateSignalInput = {
        greenhouse_id: 'gh-1',
        source_type: 'slack',
        external_id: 'msg-99999',
        title: 'Signal in GH1',
        body: 'Test body',
        author: 'Test Author',
        author_type: 'user',
        score: 0.5,
        scoring_factors: { relevance: 0.5 },
        status: 'pending',
      };

      const created1 = await storage.createSignal(input1);

      // Try to create the same signal in greenhouse 2 - should fail due to UNIQUE constraint
      const input2: CreateSignalInput = {
        greenhouse_id: 'gh-2',
        source_type: 'slack',
        external_id: 'msg-99999',
        title: 'Signal in GH2',
        body: 'Test body',
        author: 'Test Author',
        author_type: 'user',
        score: 0.5,
        scoring_factors: { relevance: 0.5 },
        status: 'pending',
      };

      // This should throw because of UNIQUE(source_type, external_id) constraint
      await expect(storage.createSignal(input2)).rejects.toThrow();

      // But checkExactDuplicate should return the first signal's ID
      const duplicateId = await storage.checkExactDuplicate('slack', 'msg-99999');
      expect(duplicateId).toBe(created1.id);
    });

    it('should distinguish between different source types', async () => {
      // Create a signal from slack
      const slackSignal: CreateSignalInput = {
        greenhouse_id: 'gh-1',
        source_type: 'slack',
        external_id: 'msg-555',
        title: 'Slack Signal',
        body: 'Test body',
        author: 'Test Author',
        author_type: 'user',
        score: 0.5,
        scoring_factors: { relevance: 0.5 },
        status: 'pending',
      };

      await storage.createSignal(slackSignal);

      // Create a signal from twitter with the same external_id
      const twitterSignal: CreateSignalInput = {
        greenhouse_id: 'gh-1',
        source_type: 'twitter',
        external_id: 'msg-555',
        title: 'Twitter Signal',
        body: 'Test body',
        author: 'Test Author',
        author_type: 'user',
        score: 0.5,
        scoring_factors: { relevance: 0.5 },
        status: 'pending',
      };

      const created = await storage.createSignal(twitterSignal);

      // Check for duplicate using slack source - should find the first signal
      const slackDuplicate = await storage.checkExactDuplicate('slack', 'msg-555');
      expect(slackDuplicate).not.toBeNull();
      expect(slackDuplicate).not.toBe(created.id);

      // Check for duplicate using twitter source - should find the second signal
      const twitterDuplicate = await storage.checkExactDuplicate('twitter', 'msg-555');
      expect(twitterDuplicate).toBe(created.id);
    });
  });

  describe('getSignalByExternalId', () => {
    it('should return null when no signal exists with the source_type and external_id', async () => {
      const result = await storage.getSignalByExternalId('slack', 'msg-99999');
      expect(result).toBeNull();
    });

    it('should return the full signal when it exists', async () => {
      // Create a signal
      const input: CreateSignalInput = {
        greenhouse_id: 'gh-1',
        source_type: 'slack',
        external_id: 'msg-77777',
        title: 'Test Signal',
        body: 'Test body content',
        author: 'Test Author',
        author_type: 'user',
        score: 0.75,
        scoring_factors: { relevance: 0.8, importance: 0.7 },
        status: 'pending',
        tags: ['tag1', 'tag2'],
      };

      const created = await storage.createSignal(input);

      // Get signal by external ID
      const retrieved = await storage.getSignalByExternalId('slack', 'msg-77777');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Signal');
      expect(retrieved?.body).toBe('Test body content');
      expect(retrieved?.source_type).toBe('slack');
      expect(retrieved?.external_id).toBe('msg-77777');
      expect(retrieved?.score).toBe(0.75);
    });
  });
});
