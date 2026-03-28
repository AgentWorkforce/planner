import { describe, it, expect } from 'vitest';
import { createStep } from '../domain/step.js';
import {
  estimateComplexity,
  estimateComplexityBatch,
  enrichStepsWithComplexity,
  countTokens,
  detectComplexityKeywords,
  getFoundKeywords,
  summarizeComplexity,
  COMPLEXITY_KEYWORDS,
} from './complexity-estimator.js';
import { DEFAULT_PLANNER_CONFIG } from '../tuner/config.js';

describe('countTokens', () => {
  it('should return 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('should estimate tokens at ~4 chars per token', () => {
    const text = 'a'.repeat(100);
    expect(countTokens(text)).toBe(25);
  });

  it('should round up', () => {
    expect(countTokens('abc')).toBe(1); // ceil(3/4)
  });
});

describe('detectComplexityKeywords', () => {
  it('should return 0 for empty text', () => {
    expect(detectComplexityKeywords('')).toBe(0);
  });

  it('should detect a single keyword', () => {
    expect(detectComplexityKeywords('Implement database migration')).toBeGreaterThanOrEqual(1);
  });

  it('should detect multiple keywords', () => {
    const text = 'Security migration with authentication and encryption';
    expect(detectComplexityKeywords(text)).toBeGreaterThanOrEqual(3);
  });

  it('should be case insensitive', () => {
    expect(detectComplexityKeywords('MIGRATION')).toBe(detectComplexityKeywords('migration'));
  });

  it('should use word boundary matching', () => {
    // "api" should match as whole word
    expect(detectComplexityKeywords('Build a REST api')).toBeGreaterThanOrEqual(1);
  });
});

describe('getFoundKeywords', () => {
  it('should return empty array for empty text', () => {
    expect(getFoundKeywords('')).toEqual([]);
  });

  it('should return found keywords', () => {
    const found = getFoundKeywords('security migration');
    expect(found).toContain('security');
    expect(found).toContain('migration');
  });
});

describe('estimateComplexity', () => {
  it('should return trivial for empty step', () => {
    const step = createStep('Empty step');
    const result = estimateComplexity(step);
    expect(result.level).toBe('trivial');
    expect(result.score).toBeLessThan(15);
  });

  it('should increase score with long description', () => {
    const shortStep = createStep('Short', { description: 'Brief task' });
    const longStep = createStep('Long', {
      description: 'A'.repeat(3000), // >500 tokens
    });

    const shortResult = estimateComplexity(shortStep);
    const longResult = estimateComplexity(longStep);
    expect(longResult.score).toBeGreaterThan(shortResult.score);
  });

  it('should increase score for each complexity keyword', () => {
    const noKeywords = createStep('Simple task', { description: 'Just a basic thing' });
    const withKeywords = createStep('Complex task', {
      description: 'This involves migration, security, and refactoring',
    });

    const noResult = estimateComplexity(noKeywords);
    const withResult = estimateComplexity(withKeywords);
    expect(withResult.score).toBeGreaterThan(noResult.score);
  });

  it('should increase score with multiple dependencies', () => {
    const noDeps = createStep('No deps');
    const manyDeps = createStep('Many deps', {
      dependencies: ['dep-1', 'dep-2', 'dep-3', 'dep-4'],
    });

    const noResult = estimateComplexity(noDeps);
    const manyResult = estimateComplexity(manyDeps);
    expect(manyResult.score).toBeGreaterThan(noResult.score);
  });

  it('should map score to correct levels', () => {
    // Trivial: <15
    const trivial = createStep('Trivial');
    expect(estimateComplexity(trivial).level).toBe('trivial');

    // We can't easily force exact scores, but we can check structure
    const result = estimateComplexity(trivial);
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('recommendation');
  });

  it('should apply language tier multiplier', () => {
    const step = createStep('Python task', {
      description: 'Write some code',
    });

    const noTier = estimateComplexity(step);
    const tierD = estimateComplexity(step, { languageTier: 'd' });

    // Tier D = 5.0x multiplier vs default
    expect(tierD.score).toBeGreaterThan(noTier.score);
  });

  it('should apply tier D = 5.0x multiplier', () => {
    const step = createStep('Code task', {
      description: 'Write a moderate amount of code for testing purposes',
      dependencies: ['dep-1'],
    });

    const tierS = estimateComplexity(step, { languageTier: 's' });
    const tierD = estimateComplexity(step, { languageTier: 'd' });

    // With 5.0x multiplier, score should be roughly 5x
    expect(tierD.score / tierS.score).toBeCloseTo(5.0, 0);
  });

  it('should use custom weights from config', () => {
    const step = createStep('Task', {
      description: 'A moderate description for testing',
      dependencies: ['dep-1'],
    });

    const defaultResult = estimateComplexity(step);
    const customResult = estimateComplexity(step, {
      config: {
        ...DEFAULT_PLANNER_CONFIG,
        complexity_weights: {
          ...DEFAULT_PLANNER_CONFIG.complexity_weights,
          dependency_weight: 50, // 10x default
        },
      },
    });

    expect(customResult.score).toBeGreaterThan(defaultResult.score);
  });

  it('should map recommendation to score thresholds', () => {
    const step = createStep('Task', { description: 'Brief' });
    const result = estimateComplexity(step);

    if (result.score < 30) {
      expect(result.recommendation).toBe('proceed');
    } else if (result.score < 60) {
      expect(result.recommendation).toBe('consider_decomposition');
    } else {
      expect(result.recommendation).toBe('require_decomposition');
    }
  });

  it('should set confidence to 0.5 without historical data', () => {
    const step = createStep('Task');
    const result = estimateComplexity(step);
    expect(result.confidence).toBe(0.5);
  });

  it('should set confidence to 0.8 with historical data', () => {
    const step = createStep('Task');
    const result = estimateComplexity(step, { historicalAvg: 45 });
    expect(result.confidence).toBe(0.8);
  });

  it('should include signals in result', () => {
    const step = createStep('Task', {
      description: 'A task with migration',
      dependencies: ['dep-1'],
      acceptance_criteria: [{ id: 'ac1', description: 'Test' }],
    });

    const result = estimateComplexity(step);
    expect(result.signals).toHaveProperty('description_tokens');
    expect(result.signals).toHaveProperty('dependency_count');
    expect(result.signals.dependency_count).toBe(1);
    expect(result.signals).toHaveProperty('ac_count');
    expect(result.signals.ac_count).toBe(1);
    expect(result.signals).toHaveProperty('keyword_boost');
    expect(result.signals.keyword_boost).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateComplexityBatch', () => {
  it('should estimate complexity for multiple steps', () => {
    const steps = [
      createStep('Step 1'),
      createStep('Step 2', { description: 'Some work' }),
    ];

    const results = estimateComplexityBatch(steps);
    expect(results.size).toBe(2);

    for (const step of steps) {
      expect(results.has(step.step_id)).toBe(true);
    }
  });
});

describe('enrichStepsWithComplexity', () => {
  it('should add complexity estimate to steps without one', () => {
    const steps = [createStep('Task 1'), createStep('Task 2')];
    const enriched = enrichStepsWithComplexity(steps);

    for (const step of enriched) {
      expect(step.complexity_estimate).toBeDefined();
    }
  });

  it('should preserve existing complexity estimates', () => {
    const existing = {
      level: 'complex' as const,
      score: 80,
      confidence: 0.9,
      signals: {
        description_tokens: 100,
        scope_count: 1,
        dependency_count: 0,
        ac_count: 0,
        keyword_boost: 0,
        language_multiplier: 1.0,
      },
      recommendation: 'require_decomposition' as const,
    };

    const step = createStep('Manual', { complexity_estimate: existing });
    const enriched = enrichStepsWithComplexity([step]);

    expect(enriched[0].complexity_estimate).toEqual(existing);
  });
});

describe('summarizeComplexity', () => {
  it('should summarize complexity for empty steps', () => {
    const summary = summarizeComplexity([]);
    expect(summary.totalSteps).toBe(0);
    expect(summary.averageScore).toBe(0);
    expect(summary.maxScore).toBe(0);
  });

  it('should summarize complexity across steps', () => {
    const steps = [
      createStep('Step 1'),
      createStep('Step 2', { description: 'Some work' }),
      createStep('Step 3', { description: 'More complex work with migration' }),
    ];

    const summary = summarizeComplexity(steps);
    expect(summary.totalSteps).toBe(3);
    expect(summary.averageScore).toBeGreaterThanOrEqual(0);
    expect(summary.maxScore).toBeGreaterThanOrEqual(summary.averageScore);
  });

  it('should track steps requiring decomposition', () => {
    const summary = summarizeComplexity([createStep('Simple')]);
    expect(summary.stepsRequiringDecomposition).toBeDefined();
    expect(summary.stepsConsideringDecomposition).toBeDefined();
  });

  it('should count levels correctly', () => {
    const steps = [createStep('Step 1'), createStep('Step 2')];
    const summary = summarizeComplexity(steps);

    const totalByLevel = Object.values(summary.byLevel).reduce((a, b) => a + b, 0);
    expect(totalByLevel).toBe(steps.length);
  });
});
