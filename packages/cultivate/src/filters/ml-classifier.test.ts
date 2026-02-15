/**
 * Tests for Tier 2 ML classifier
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tier2Filter, type Tier2CategoryLabel } from './ml-classifier.js';

// Mock the model-loader module
vi.mock('../ml/model-loader.js', () => {
  let mockClassifier: any = null;

  return {
    getClassifier: vi.fn(() => {
      if (!mockClassifier) {
        throw new Error('ML model not loaded. Call loadClassificationModel() first.');
      }
      return mockClassifier;
    }),
    // Helper for tests to set the mock classifier
    __setMockClassifier: (classifier: any) => {
      mockClassifier = classifier;
    },
    __clearMockClassifier: () => {
      mockClassifier = null;
    },
  };
});

// Import the mock helpers
import { __setMockClassifier, __clearMockClassifier } from '../ml/model-loader.js';

describe('tier2Filter', () => {
  beforeEach(() => {
    // Clear mock before each test
    __clearMockClassifier();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when model not loaded', async () => {
    // No classifier set - should throw
    await expect(tier2Filter('test text', 0.3)).rejects.toThrow(
      'ML model not loaded. Call loadClassificationModel() first.'
    );
  });

  it('should return correct structure for valid classification', async () => {
    // Mock classifier that returns product_feedback as top label
    const mockClassifier = vi.fn(async () => ({
      labels: ['product_feedback', 'feature_request', 'bug_report', 'question', 'noise'],
      scores: [0.8, 0.1, 0.05, 0.03, 0.02],
    }));

    __setMockClassifier(mockClassifier);

    const result = await tier2Filter('This is great product feedback', 0.3);

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('feedback_score');
    expect(result).toHaveProperty('category_hint');
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.feedback_score).toBe('number');
    expect(typeof result.category_hint).toBe('string');
  });

  it('should pass when top label is NOT noise and score >= threshold', async () => {
    const mockClassifier = vi.fn(async () => ({
      labels: ['product_feedback', 'noise', 'feature_request', 'bug_report', 'question'],
      scores: [0.7, 0.15, 0.1, 0.03, 0.02],
    }));

    __setMockClassifier(mockClassifier);

    const result = await tier2Filter('Great feature idea', 0.3);

    expect(result.passed).toBe(true);
    expect(result.feedback_score).toBe(0.7);
    expect(result.category_hint).toBe('product_feedback');
  });

  it('should fail when top label is noise (regardless of score)', async () => {
    const mockClassifier = vi.fn(async () => ({
      labels: ['noise', 'product_feedback', 'feature_request', 'bug_report', 'question'],
      scores: [0.9, 0.05, 0.03, 0.01, 0.01],
    }));

    __setMockClassifier(mockClassifier);

    const result = await tier2Filter('Spam spam spam', 0.3);

    expect(result.passed).toBe(false);
    expect(result.feedback_score).toBe(0.9);
    expect(result.category_hint).toBe('noise');
  });

  it('should fail when non-noise label has score below threshold', async () => {
    const mockClassifier = vi.fn(async () => ({
      labels: ['product_feedback', 'noise', 'feature_request', 'bug_report', 'question'],
      scores: [0.2, 0.19, 0.18, 0.22, 0.21],
    }));

    __setMockClassifier(mockClassifier);

    const result = await tier2Filter('Ambiguous text', 0.3);

    expect(result.passed).toBe(false);
    expect(result.feedback_score).toBe(0.2);
    expect(result.category_hint).toBe('product_feedback');
  });

  it('should truncate very long text to 2000 characters', async () => {
    const longText = 'a'.repeat(3000);

    const mockClassifier = vi.fn(async (text: string) => {
      expect(text.length).toBe(2000); // Should be truncated
      return {
        labels: ['product_feedback', 'noise', 'feature_request', 'bug_report', 'question'],
        scores: [0.7, 0.15, 0.1, 0.03, 0.02],
      };
    });

    __setMockClassifier(mockClassifier);

    await tier2Filter(longText, 0.3);

    expect(mockClassifier).toHaveBeenCalledTimes(1);
  });

  it('should not truncate text under 2000 characters', async () => {
    const shortText = 'Short text for testing';

    const mockClassifier = vi.fn(async (text: string) => {
      expect(text).toBe(shortText); // Should not be truncated
      return {
        labels: ['product_feedback', 'noise', 'feature_request', 'bug_report', 'question'],
        scores: [0.7, 0.15, 0.1, 0.03, 0.02],
      };
    });

    __setMockClassifier(mockClassifier);

    await tier2Filter(shortText, 0.3);

    expect(mockClassifier).toHaveBeenCalledTimes(1);
  });

  it('should use default threshold of 0.3 when not provided', async () => {
    const mockClassifier = vi.fn(async () => ({
      labels: ['product_feedback', 'noise', 'feature_request', 'bug_report', 'question'],
      scores: [0.29, 0.25, 0.2, 0.15, 0.11],
    }));

    __setMockClassifier(mockClassifier);

    const result = await tier2Filter('Some text');

    // Score 0.29 is below default threshold 0.3
    expect(result.passed).toBe(false);
  });

  it('should pass with score exactly at threshold', async () => {
    const mockClassifier = vi.fn(async () => ({
      labels: ['bug_report', 'noise', 'product_feedback', 'feature_request', 'question'],
      scores: [0.3, 0.25, 0.2, 0.15, 0.1],
    }));

    __setMockClassifier(mockClassifier);

    const result = await tier2Filter('Bug report text', 0.3);

    // Score 0.3 meets threshold 0.3 (>=)
    expect(result.passed).toBe(true);
    expect(result.category_hint).toBe('bug_report');
  });

  it('should handle all category labels correctly', async () => {
    const categories: Tier2CategoryLabel[] = [
      'product_feedback',
      'bug_report',
      'feature_request',
      'question',
      'noise',
    ];

    for (const category of categories) {
      const mockClassifier = vi.fn(async () => ({
        labels: [category, ...categories.filter((c) => c !== category)],
        scores: [0.8, 0.05, 0.05, 0.05, 0.05],
      }));

      __setMockClassifier(mockClassifier);

      const result = await tier2Filter('Test text', 0.3);

      expect(result.category_hint).toBe(category);

      if (category === 'noise') {
        expect(result.passed).toBe(false);
      } else {
        expect(result.passed).toBe(true);
      }

      __clearMockClassifier();
    }
  });

  it('should pass candidate labels to classifier correctly', async () => {
    const mockClassifier = vi.fn(async (text: string, labels: string[]) => {
      // Verify all 5 labels are passed
      expect(labels).toHaveLength(5);
      expect(labels).toContain('product_feedback');
      expect(labels).toContain('bug_report');
      expect(labels).toContain('feature_request');
      expect(labels).toContain('question');
      expect(labels).toContain('noise');

      return {
        labels: ['product_feedback', 'bug_report', 'feature_request', 'question', 'noise'],
        scores: [0.7, 0.15, 0.1, 0.03, 0.02],
      };
    });

    __setMockClassifier(mockClassifier);

    await tier2Filter('Test text', 0.3);

    expect(mockClassifier).toHaveBeenCalledTimes(1);
  });
});
