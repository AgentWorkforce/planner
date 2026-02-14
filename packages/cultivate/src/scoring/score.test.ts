/**
 * Tests for signal scoring engine
 */

import { describe, it, expect } from 'vitest';
import { scoreSignal } from './score.js';
import { DEFAULT_WEIGHTS } from './weights.js';

describe('scoreSignal', () => {
  it('should calculate composite score with default weights', () => {
    const result = scoreSignal({
      signalTimestamp: new Date(),
      extractionResult: {
        specificity: 0.8,
        emotional_intensity: 0.6,
        actionability: 0.7,
      },
      sourceTier: 'tier1',
      clusterSignalCount: 5,
      signalKeywords: ['typescript', 'refactor', 'performance'],
      greenhouseKeywords: ['typescript', 'performance', 'optimization'],
      title: 'Refactor TypeScript service for better performance',
      body: 'We need to optimize the service layer by refactoring the database queries and improving caching strategies.',
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('should apply custom greenhouse overrides', () => {
    const result = scoreSignal(
      {
        signalTimestamp: new Date(),
        extractionResult: {
          specificity: 0.8,
          emotional_intensity: 0.6,
          actionability: 0.7,
        },
        sourceTier: 'tier1',
        signalKeywords: ['bug', 'critical'],
        greenhouseKeywords: ['bug', 'urgent'],
        title: 'Critical bug in payment system',
        body: 'Payment processing is failing for some users.',
      },
      {
        greenhouseOverrides: {
          strategic_fit: 0.5, // Higher weight on strategic fit
        },
      }
    );

    expect(result.weights.strategic_fit).toBe(0.5);
    expect(result.weights.recency).toBe(DEFAULT_WEIGHTS.recency); // Others use defaults
  });

  it('should calculate all 8 factors', () => {
    const result = scoreSignal({
      signalTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      extractionResult: {
        specificity: 0.9,
        emotional_intensity: 0.5,
        actionability: 0.8,
      },
      sourceTier: 'tier2',
      clusterSignalCount: 3,
      signalKeywords: ['api', 'rest', 'design'],
      greenhouseKeywords: ['api', 'architecture'],
      title: 'API design improvements needed',
      body: 'Current REST API has several design issues:\n\n- Inconsistent naming\n- Missing pagination\n- Poor error handling',
    });

    const { factors } = result;

    expect(factors.recency).toBeGreaterThan(0);
    expect(factors.specificity).toBe(0.9);
    expect(factors.source_authority).toBe(0.7); // tier2
    expect(factors.repetition).toBeGreaterThan(0);
    expect(factors.emotional_intensity).toBe(0.5);
    expect(factors.strategic_fit).toBeGreaterThan(0);
    expect(factors.actionability).toBe(0.8);
    expect(factors.content_quality).toBeGreaterThan(0);
  });

  it('should clamp score to [0, 1] range', () => {
    const result = scoreSignal({
      signalTimestamp: new Date(),
      extractionResult: {
        specificity: 1.0,
        emotional_intensity: 1.0,
        actionability: 1.0,
      },
      sourceTier: 'tier1',
      clusterSignalCount: 100,
      signalKeywords: ['test'],
      greenhouseKeywords: ['test'],
      title: 'A perfectly reasonable title for testing',
      body: 'A body with good length and structure that should score well for content quality metrics.',
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
